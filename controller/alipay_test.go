package controller

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func generateAlipayTestKeys(t *testing.T) (string, string) {
	t.Helper()

	key, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)

	privateBytes := x509.MarshalPKCS1PrivateKey(key)
	privatePEM := pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: privateBytes})

	publicBytes, err := x509.MarshalPKIXPublicKey(&key.PublicKey)
	require.NoError(t, err)

	return string(privatePEM), base64.StdEncoding.EncodeToString(publicBytes)
}

func setupAlipayControllerTestDB(t *testing.T) {
	t.Helper()

	gin.SetMode(gin.TestMode)
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	common.RedisEnabled = false

	db, err := gorm.Open(sqlite.Open("file:"+strings.ReplaceAll(t.Name(), "/", "_")+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db
	model.LOG_DB = db
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.TopUp{}, &model.Log{}))

	t.Cleanup(func() {
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})
}

func TestAlipaySignAndVerifyRoundTrip(t *testing.T) {
	privateKey, publicKey := generateAlipayTestKeys(t)
	params := map[string]string{
		"app_id":       "2021000000000000",
		"method":       "alipay.trade.page.pay",
		"charset":      "utf-8",
		"sign_type":    "RSA2",
		"timestamp":    "2026-05-03 12:00:00",
		"version":      "1.0",
		"biz_content":  `{"out_trade_no":"USR1NOabc","total_amount":"10.00"}`,
		"total_amount": "10.00",
	}

	sign, err := signAlipayParams(params, privateKey)
	require.NoError(t, err)

	params["sign"] = sign
	require.NoError(t, verifyAlipayParams(params, publicKey))

	params["total_amount"] = "99.99"
	require.Error(t, verifyAlipayParams(params, publicKey))
}

func TestBuildAlipaySignContentSortsAndOnlySkipsSign(t *testing.T) {
	values := url.Values{}
	values.Set("sign", "ignored")
	values.Set("sign_type", "RSA2")
	values.Set("b", "two words")
	values.Set("a", "1")
	values.Set("empty", "")

	require.Equal(t, "a=1&b=two words&sign_type=RSA2", buildAlipaySignContent(values))
}

func TestCurrentAlipayGatewayIncludesCharsetQuery(t *testing.T) {
	originalSandbox := setting.AlipaySandbox
	t.Cleanup(func() {
		setting.AlipaySandbox = originalSandbox
	})

	setting.AlipaySandbox = false
	require.Equal(t, alipayGatewayProduction+"?charset=utf-8", currentAlipayGateway())

	setting.AlipaySandbox = true
	require.Equal(t, alipayGatewaySandbox+"?charset=utf-8", currentAlipayGateway())
}

func TestAlipayTopUpEnabledRequiresConfiguredKeys(t *testing.T) {
	originalEnabled := setting.AlipayEnabled
	originalSandbox := setting.AlipaySandbox
	originalAppID := setting.AlipayAppID
	originalPrivateKey := setting.AlipayPrivateKey
	originalPublicKey := setting.AlipayPublicKey
	t.Cleanup(func() {
		setting.AlipayEnabled = originalEnabled
		setting.AlipaySandbox = originalSandbox
		setting.AlipayAppID = originalAppID
		setting.AlipayPrivateKey = originalPrivateKey
		setting.AlipayPublicKey = originalPublicKey
	})

	setting.AlipayEnabled = false
	setting.AlipaySandbox = false
	setting.AlipayAppID = "app"
	setting.AlipayPrivateKey = "private"
	setting.AlipayPublicKey = "public"
	require.False(t, isAlipayTopUpEnabled())

	setting.AlipayEnabled = true
	setting.AlipayPrivateKey = ""
	require.False(t, isAlipayTopUpEnabled())

	setting.AlipayPrivateKey = "private"
	require.True(t, isAlipayTopUpEnabled())
	require.True(t, isAlipayWebhookEnabled())
}

func TestAlipayNotifyCreditsPendingTopUp(t *testing.T) {
	setupAlipayControllerTestDB(t)
	privateKey, publicKey := generateAlipayTestKeys(t)

	originalEnabled := setting.AlipayEnabled
	originalAppID := setting.AlipayAppID
	originalPrivateKey := setting.AlipayPrivateKey
	originalPublicKey := setting.AlipayPublicKey
	t.Cleanup(func() {
		setting.AlipayEnabled = originalEnabled
		setting.AlipayAppID = originalAppID
		setting.AlipayPrivateKey = originalPrivateKey
		setting.AlipayPublicKey = originalPublicKey
	})

	setting.AlipayEnabled = true
	setting.AlipayAppID = "2021000000000000"
	setting.AlipayPrivateKey = privateKey
	setting.AlipayPublicKey = publicKey

	user := &model.User{Id: 9001, Username: "alipay_user", Status: common.UserStatusEnabled, Quota: 0}
	require.NoError(t, model.DB.Create(user).Error)
	topUp := &model.TopUp{
		UserId:          user.Id,
		Amount:          10,
		Money:           73,
		TradeNo:         "USR9001NOALIPAY",
		PaymentMethod:   model.PaymentMethodAlipayOfficial,
		PaymentProvider: model.PaymentProviderAlipay,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	require.NoError(t, topUp.Insert())

	params := map[string]string{
		"app_id":       setting.AlipayAppID,
		"out_trade_no": topUp.TradeNo,
		"trade_no":     "2026050322000000000001",
		"trade_status": "TRADE_SUCCESS",
		"total_amount": "73.00",
		"seller_id":    "2088000000000000",
		"charset":      "utf-8",
		"sign_type":    "RSA2",
		"timestamp":    "2026-05-03 12:00:00",
		"version":      "1.0",
	}
	sign, err := signAlipayParams(params, privateKey)
	require.NoError(t, err)

	form := url.Values{}
	for key, value := range params {
		form.Set(key, value)
	}
	form.Set("sign", sign)

	req := httptest.NewRequest(http.MethodPost, "/api/alipay/notify", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = req

	AlipayNotify(c)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Equal(t, "success", recorder.Body.String())

	stored := model.GetTopUpByTradeNo(topUp.TradeNo)
	require.NotNil(t, stored)
	require.Equal(t, common.TopUpStatusSuccess, stored.Status)

	var updated model.User
	require.NoError(t, model.DB.Select("quota").Where("id = ?", user.Id).First(&updated).Error)
	require.Equal(t, int(10*common.QuotaPerUnit), updated.Quota)
}

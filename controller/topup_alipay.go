package controller

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

const (
	alipayGatewayProduction = "https://openapi.alipay.com/gateway.do"
	alipayGatewaySandbox    = "https://openapi-sandbox.dl.alipaydev.com/gateway.do"
	alipayMethodPagePay     = "alipay.trade.page.pay"
	alipayTradeSuccess      = "TRADE_SUCCESS"
	alipayTradeFinished     = "TRADE_FINISHED"
)

type AlipayPayRequest struct {
	Amount int64 `json:"amount"`
}

type alipayPagePayBizContent struct {
	OutTradeNo  string `json:"out_trade_no"`
	ProductCode string `json:"product_code"`
	TotalAmount string `json:"total_amount"`
	Subject     string `json:"subject"`
}

func currentAlipayGateway() string {
	gateway := alipayGatewayProduction
	if setting.AlipaySandbox {
		gateway = alipayGatewaySandbox
	}

	gatewayURL, err := url.Parse(gateway)
	if err != nil {
		return gateway
	}
	query := gatewayURL.Query()
	query.Set("charset", "utf-8")
	gatewayURL.RawQuery = query.Encode()
	return gatewayURL.String()
}

func decodeAlipayKey(raw string) ([]byte, error) {
	trimmed := strings.TrimSpace(strings.ReplaceAll(raw, "\\n", "\n"))
	if trimmed == "" {
		return nil, errors.New("empty alipay key")
	}

	if strings.Contains(trimmed, "-----BEGIN") {
		block, _ := pem.Decode([]byte(trimmed))
		if block == nil {
			return nil, errors.New("invalid alipay pem key")
		}
		return block.Bytes, nil
	}

	compact := strings.NewReplacer("\n", "", "\r", "", "\t", "", " ", "").Replace(trimmed)
	decoded, err := base64.StdEncoding.DecodeString(compact)
	if err != nil {
		return nil, err
	}
	return decoded, nil
}

func parseAlipayPrivateKey(raw string) (*rsa.PrivateKey, error) {
	keyBytes, err := decodeAlipayKey(raw)
	if err != nil {
		return nil, err
	}

	if key, err := x509.ParsePKCS1PrivateKey(keyBytes); err == nil {
		return key, nil
	}

	parsed, err := x509.ParsePKCS8PrivateKey(keyBytes)
	if err != nil {
		return nil, err
	}
	key, ok := parsed.(*rsa.PrivateKey)
	if !ok {
		return nil, errors.New("alipay private key is not rsa")
	}
	return key, nil
}

func parseAlipayPublicKey(raw string) (*rsa.PublicKey, error) {
	keyBytes, err := decodeAlipayKey(raw)
	if err != nil {
		return nil, err
	}

	if parsed, err := x509.ParsePKIXPublicKey(keyBytes); err == nil {
		key, ok := parsed.(*rsa.PublicKey)
		if !ok {
			return nil, errors.New("alipay public key is not rsa")
		}
		return key, nil
	}

	return x509.ParsePKCS1PublicKey(keyBytes)
}

func buildAlipaySignContent(values url.Values) string {
	keys := make([]string, 0, len(values))
	for key := range values {
		if key == "sign" || key == "sign_type" || values.Get(key) == "" {
			continue
		}
		keys = append(keys, key)
	}
	sort.Strings(keys)

	parts := make([]string, 0, len(keys))
	for _, key := range keys {
		parts = append(parts, key+"="+values.Get(key))
	}
	return strings.Join(parts, "&")
}

func mapToAlipayValues(params map[string]string) url.Values {
	values := url.Values{}
	for key, value := range params {
		values.Set(key, value)
	}
	return values
}

func signAlipayParams(params map[string]string, privateKey string) (string, error) {
	key, err := parseAlipayPrivateKey(privateKey)
	if err != nil {
		return "", err
	}

	signContent := buildAlipaySignContent(mapToAlipayValues(params))
	hashed := sha256.Sum256([]byte(signContent))
	signature, err := rsa.SignPKCS1v15(rand.Reader, key, crypto.SHA256, hashed[:])
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(signature), nil
}

func verifyAlipayParams(params map[string]string, publicKey string) error {
	signatureText := params["sign"]
	if signatureText == "" {
		return errors.New("missing alipay sign")
	}

	signature, err := base64.StdEncoding.DecodeString(signatureText)
	if err != nil {
		return err
	}

	key, err := parseAlipayPublicKey(publicKey)
	if err != nil {
		return err
	}

	signContent := buildAlipaySignContent(mapToAlipayValues(params))
	hashed := sha256.Sum256([]byte(signContent))
	return rsa.VerifyPKCS1v15(key, crypto.SHA256, hashed[:], signature)
}

func formatAlipayAmount(amount float64) string {
	return decimal.NewFromFloat(amount).Round(2).StringFixed(2)
}

func buildAlipayRequestParams(tradeNo string, amount float64, subject string, notifyURL string, returnURL string) (map[string]string, error) {
	biz := alipayPagePayBizContent{
		OutTradeNo:  tradeNo,
		ProductCode: "FAST_INSTANT_TRADE_PAY",
		TotalAmount: formatAlipayAmount(amount),
		Subject:     subject,
	}
	bizBytes, err := common.Marshal(biz)
	if err != nil {
		return nil, err
	}

	params := map[string]string{
		"app_id":      setting.AlipayAppID,
		"method":      alipayMethodPagePay,
		"format":      "JSON",
		"charset":     "utf-8",
		"sign_type":   "RSA2",
		"timestamp":   time.Now().Format("2006-01-02 15:04:05"),
		"version":     "1.0",
		"notify_url":  notifyURL,
		"biz_content": string(bizBytes),
	}
	if strings.TrimSpace(returnURL) != "" {
		params["return_url"] = returnURL
	}

	sign, err := signAlipayParams(params, setting.AlipayPrivateKey)
	if err != nil {
		return nil, err
	}
	params["sign"] = sign
	return params, nil
}

func parseAlipayCallbackParams(c *gin.Context) (map[string]string, error) {
	if err := c.Request.ParseForm(); err != nil {
		return nil, err
	}

	params := map[string]string{}
	for key, values := range c.Request.Form {
		if len(values) > 0 {
			params[key] = values[0]
		}
	}
	return params, nil
}

func buildAlipayNotifyURL() (string, error) {
	if trimmed := strings.TrimSpace(setting.AlipayNotifyURL); trimmed != "" {
		return trimmed, nil
	}

	callbackAddress := strings.TrimRight(service.GetCallbackAddress(), "/")
	if callbackAddress == "" {
		return "", errors.New("未配置支付宝回调地址")
	}
	return callbackAddress + "/api/alipay/notify", nil
}

func buildAlipayReturnURL() string {
	if trimmed := strings.TrimSpace(setting.AlipayReturnURL); trimmed != "" {
		return trimmed
	}

	serverAddress := strings.TrimRight(system_setting.ServerAddress, "/")
	if serverAddress == "" {
		serverAddress = strings.TrimRight(service.GetCallbackAddress(), "/")
	}
	if serverAddress == "" {
		return ""
	}
	return serverAddress + "/console/topup?show_history=true"
}

func RequestAlipayAmount(c *gin.Context) {
	var req AmountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}

	if req.Amount < getMinTopup() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": fmt.Sprintf("充值数量不能小于 %d", getMinTopup())})
		return
	}

	id := c.GetInt("id")
	group, err := model.GetUserGroup(id, true)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "获取用户分组失败"})
		return
	}
	payMoney := getPayMoney(req.Amount, group)
	if payMoney <= 0.01 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "充值金额过低"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "success", "data": strconv.FormatFloat(payMoney, 'f', 2, 64)})
}

func RequestAlipayPay(c *gin.Context) {
	if !isAlipayTopUpEnabled() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "支付宝官方支付未启用"})
		return
	}

	var req AlipayPayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}
	if req.Amount < getMinTopup() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": fmt.Sprintf("充值数量不能小于 %d", getMinTopup())})
		return
	}

	id := c.GetInt("id")
	group, err := model.GetUserGroup(id, true)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "获取用户分组失败"})
		return
	}
	payMoney := getPayMoney(req.Amount, group)
	if payMoney < 0.01 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "充值金额过低"})
		return
	}

	normalizedAmount := req.Amount
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		dAmount := decimal.NewFromInt(normalizedAmount)
		dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
		normalizedAmount = dAmount.Div(dQuotaPerUnit).IntPart()
	}

	tradeNo := fmt.Sprintf("USR%dNO%s%d", id, common.GetRandomString(6), time.Now().Unix())
	topUp := &model.TopUp{
		UserId:          id,
		Amount:          normalizedAmount,
		Money:           payMoney,
		TradeNo:         tradeNo,
		PaymentMethod:   model.PaymentMethodAlipayOfficial,
		PaymentProvider: model.PaymentProviderAlipay,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	if err := topUp.Insert(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("支付宝官方 创建充值订单失败 user_id=%d trade_no=%s amount=%d error=%q", id, tradeNo, req.Amount, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}

	notifyURL, err := buildAlipayNotifyURL()
	if err != nil {
		topUp.Status = common.TopUpStatusFailed
		_ = topUp.Update()
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": err.Error()})
		return
	}

	params, err := buildAlipayRequestParams(tradeNo, payMoney, fmt.Sprintf("TUC%d", req.Amount), notifyURL, buildAlipayReturnURL())
	if err != nil {
		topUp.Status = common.TopUpStatusFailed
		_ = topUp.Update()
		logger.LogError(c.Request.Context(), fmt.Sprintf("支付宝官方 创建支付参数失败 user_id=%d trade_no=%s error=%q", id, tradeNo, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "支付配置错误"})
		return
	}

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("支付宝官方 充值订单创建成功 user_id=%d trade_no=%s amount=%d money=%.2f sandbox=%t", id, tradeNo, req.Amount, payMoney, setting.AlipaySandbox))
	c.JSON(http.StatusOK, gin.H{"message": "success", "data": params, "url": currentAlipayGateway()})
}

func AlipayNotify(c *gin.Context) {
	if !isAlipayWebhookEnabled() {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("支付宝官方 webhook 被拒绝 reason=webhook_disabled path=%q client_ip=%s", c.Request.RequestURI, c.ClientIP()))
		c.String(http.StatusOK, "failure")
		return
	}

	params, err := parseAlipayCallbackParams(c)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("支付宝官方 webhook 表单解析失败 path=%q client_ip=%s error=%q", c.Request.RequestURI, c.ClientIP(), err.Error()))
		c.String(http.StatusOK, "failure")
		return
	}

	if err := verifyAlipayParams(params, setting.AlipayPublicKey); err != nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("支付宝官方 webhook 验签失败 path=%q client_ip=%s error=%q", c.Request.RequestURI, c.ClientIP(), err.Error()))
		c.String(http.StatusOK, "failure")
		return
	}

	if params["app_id"] != setting.AlipayAppID {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("支付宝官方 webhook AppID不匹配 callback_app_id=%s expected_app_id=%s client_ip=%s", params["app_id"], setting.AlipayAppID, c.ClientIP()))
		c.String(http.StatusOK, "failure")
		return
	}

	tradeStatus := params["trade_status"]
	if tradeStatus != alipayTradeSuccess && tradeStatus != alipayTradeFinished {
		logger.LogInfo(c.Request.Context(), fmt.Sprintf("支付宝官方 webhook 忽略事件 trade_no=%s trade_status=%s client_ip=%s", params["out_trade_no"], tradeStatus, c.ClientIP()))
		c.String(http.StatusOK, "success")
		return
	}

	tradeNo := params["out_trade_no"]
	LockOrder(tradeNo)
	defer UnlockOrder(tradeNo)

	topUp := model.GetTopUpByTradeNo(tradeNo)
	if topUp == nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("支付宝官方 webhook 订单不存在 trade_no=%s client_ip=%s", tradeNo, c.ClientIP()))
		c.String(http.StatusOK, "failure")
		return
	}

	if topUp.PaymentProvider != model.PaymentProviderAlipay {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("支付宝官方 webhook 订单支付网关不匹配 trade_no=%s provider=%s client_ip=%s", tradeNo, topUp.PaymentProvider, c.ClientIP()))
		c.String(http.StatusOK, "failure")
		return
	}

	callbackAmount, err := decimal.NewFromString(params["total_amount"])
	if err != nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("支付宝官方 webhook 金额解析失败 trade_no=%s total_amount=%q client_ip=%s", tradeNo, params["total_amount"], c.ClientIP()))
		c.String(http.StatusOK, "failure")
		return
	}
	expectedAmount := decimal.NewFromFloat(topUp.Money).Round(2)
	if !callbackAmount.Round(2).Equal(expectedAmount) {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("支付宝官方 webhook 金额不匹配 trade_no=%s callback_amount=%s expected_amount=%s client_ip=%s", tradeNo, callbackAmount.StringFixed(2), expectedAmount.StringFixed(2), c.ClientIP()))
		c.String(http.StatusOK, "failure")
		return
	}

	if err := model.RechargeAlipayOfficial(tradeNo, c.ClientIP()); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("支付宝官方 充值处理失败 trade_no=%s client_ip=%s error=%q", tradeNo, c.ClientIP(), err.Error()))
		c.String(http.StatusOK, "failure")
		return
	}

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("支付宝官方 充值成功 trade_no=%s client_ip=%s alipay_trade_no=%s", tradeNo, c.ClientIP(), params["trade_no"]))
	c.String(http.StatusOK, "success")
}

func AlipayReturn(c *gin.Context) {
	target := buildAlipayReturnURL()
	if target == "" {
		c.String(http.StatusOK, "success")
		return
	}
	c.Redirect(http.StatusFound, target)
}

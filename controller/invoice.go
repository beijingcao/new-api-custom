package controller

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

type createInvoiceHeaderRequest struct {
	CompanyName string `json:"company_name" binding:"required"`
	TaxNumber   string `json:"tax_number" binding:"required"`
	BankName    string `json:"bank_name"`
	BankAccount string `json:"bank_account"`
	Email       string `json:"email" binding:"required,email"`
}

type createInvoiceRequestBody struct {
	HeaderId int      `json:"header_id" binding:"required"`
	OrderIds []string `json:"order_ids" binding:"required,min=1"`
}

func GetInvoiceHeaders(c *gin.Context) {
	userId := c.GetInt("id")
	headers, err := model.GetInvoiceHeadersByUserId(userId)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": headers})
}

func CreateInvoiceHeader(c *gin.Context) {
	userId := c.GetInt("id")
	var req createInvoiceHeaderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "invalid request: " + err.Error()})
		return
	}

	header := &model.InvoiceHeader{
		UserId:      userId,
		CompanyName: req.CompanyName,
		TaxNumber:   req.TaxNumber,
		BankName:    req.BankName,
		BankAccount: req.BankAccount,
		Email:       req.Email,
	}
	if err := model.CreateInvoiceHeader(header); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": header})
}

func DeleteInvoiceHeader(c *gin.Context) {
	userId := c.GetInt("id")
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "invalid id"})
		return
	}
	if err := model.DeleteInvoiceHeader(id, userId); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "ok"})
}

func GetInvoiceRequests(c *gin.Context) {
	userId := c.GetInt("id")
	requests, err := model.GetInvoiceRequestsByUserId(userId)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	invoicedIds, _ := model.GetInvoicedOrderIds(userId)
	c.JSON(http.StatusOK, gin.H{
		"success":     true,
		"data":        requests,
		"invoiced_ids": invoicedIds,
	})
}

func CreateInvoiceRequest(c *gin.Context) {
	userId := c.GetInt("id")
	var req createInvoiceRequestBody
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "invalid request: " + err.Error()})
		return
	}

	// Verify header belongs to user
	header, err := model.GetInvoiceHeaderById(req.HeaderId, userId)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "invoice header not found"})
		return
	}

	// Check none of the orders have already been invoiced
	invoicedIds, _ := model.GetInvoicedOrderIds(userId)
	invoicedSet := make(map[string]bool)
	for _, id := range invoicedIds {
		invoicedSet[id] = true
	}
	for _, oid := range req.OrderIds {
		if invoicedSet[oid] {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": fmt.Sprintf("order %s has already been invoiced", oid)})
			return
		}
	}

	// Fetch orders to calculate total amount
	var totalMoney float64
	var orderDetails []string
	for _, tradeNo := range req.OrderIds {
		topUp := model.GetTopUpByTradeNo(tradeNo)
		if topUp == nil || topUp.UserId != userId || topUp.Status != common.TopUpStatusSuccess {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": fmt.Sprintf("order %s is invalid", tradeNo)})
			return
		}
		totalMoney += topUp.Money
		orderDetails = append(orderDetails, fmt.Sprintf("- Order: %s, Amount: ¥%.2f", topUp.TradeNo, topUp.Money))
	}

	orderIdsJson, _ := common.Marshal(req.OrderIds)

	invoiceReq := &model.InvoiceRequest{
		UserId:      userId,
		HeaderId:    req.HeaderId,
		OrderIds:    string(orderIdsJson),
		TotalAmount: totalMoney,
		Status:      "pending",
	}
	if err := model.CreateInvoiceRequest(invoiceReq); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	// Send email notification to admin
	go func() {
		adminUser := model.GetRootUser()
		if adminUser == nil || adminUser.Email == "" {
			common.SysLog("invoice request: no admin email configured")
			return
		}

		subject := fmt.Sprintf("Invoice Request #%d", invoiceReq.Id)
		content := fmt.Sprintf(`
<h2>New Invoice Request</h2>
<p><strong>Request ID:</strong> %d</p>
<h3>Invoice Header</h3>
<table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;">
<tr><td><strong>Company</strong></td><td>%s</td></tr>
<tr><td><strong>Tax Number</strong></td><td>%s</td></tr>
<tr><td><strong>Bank</strong></td><td>%s</td></tr>
<tr><td><strong>Bank Account</strong></td><td>%s</td></tr>
<tr><td><strong>Email</strong></td><td>%s</td></tr>
</table>
<h3>Orders</h3>
<pre>%s</pre>
<p><strong>Total Amount: ¥%.2f</strong></p>
`,
			invoiceReq.Id,
			header.CompanyName, header.TaxNumber,
			header.BankName, header.BankAccount, header.Email,
			strings.Join(orderDetails, "\n"),
			totalMoney,
		)
		if err := common.SendEmail(subject, adminUser.Email, content); err != nil {
			common.SysLog(fmt.Sprintf("invoice request email failed: %s", err.Error()))
		}
	}()

	c.JSON(http.StatusOK, gin.H{"success": true, "data": invoiceReq})
}

package controller

import (
	"fmt"
	"net/http"
	"strconv"

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
	invoicedStatus, _ := model.GetInvoicedOrderStatuses(userId)
	c.JSON(http.StatusOK, gin.H{
		"success":         true,
		"data":            requests,
		"invoiced_ids":    invoicedIds,
		"invoiced_status": invoicedStatus,
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
	_, err := model.GetInvoiceHeaderById(req.HeaderId, userId)
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
	for _, tradeNo := range req.OrderIds {
		topUp := model.GetTopUpByTradeNo(tradeNo)
		if topUp == nil || topUp.UserId != userId || topUp.Status != common.TopUpStatusSuccess {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": fmt.Sprintf("order %s is invalid", tradeNo)})
			return
		}
		totalMoney += topUp.Money
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

	c.JSON(http.StatusOK, gin.H{"success": true, "data": invoiceReq})
}

// Admin endpoints

func AdminGetInvoiceRequests(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	results, total, err := model.GetAllInvoiceRequests(pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(results)
	common.ApiSuccess(c, pageInfo)
}

type updateInvoiceStatusRequest struct {
	Status string `json:"status" binding:"required,oneof=pending completed"`
	Note   string `json:"note"`
}

func AdminUpdateInvoiceRequest(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "invalid id"})
		return
	}
	var req updateInvoiceStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "invalid request: " + err.Error()})
		return
	}
	if err := model.UpdateInvoiceRequestStatus(id, req.Status, req.Note); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "ok"})
}

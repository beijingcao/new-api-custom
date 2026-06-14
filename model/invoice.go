package model

import (
	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

type InvoiceHeader struct {
	Id          int    `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId      int    `json:"user_id" gorm:"index"`
	CompanyName string `json:"company_name" gorm:"type:varchar(255);not null"`
	TaxNumber   string `json:"tax_number" gorm:"type:varchar(100);not null"`
	BankName    string `json:"bank_name" gorm:"type:varchar(255)"`
	BankAccount string `json:"bank_account" gorm:"type:varchar(100)"`
	Email       string `json:"email" gorm:"type:varchar(255);not null"`
	CreatedAt   int64  `json:"created_at" gorm:"autoCreateTime"`
}

type InvoiceRequest struct {
	Id          int     `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId      int     `json:"user_id" gorm:"index"`
	HeaderId    int     `json:"header_id"`
	OrderIds    string  `json:"order_ids" gorm:"type:text"`
	TotalAmount float64 `json:"total_amount"`
	Status      string  `json:"status" gorm:"type:varchar(20);default:'pending'"`
	Note        string  `json:"note" gorm:"type:text"`
	CreatedAt   int64   `json:"created_at" gorm:"autoCreateTime"`
}

type InvoiceRequestDetail struct {
	InvoiceRequest
	Username    string         `json:"username"`
	Header      *InvoiceHeader `json:"header"`
}

func GetInvoiceHeadersByUserId(userId int) (headers []InvoiceHeader, err error) {
	err = DB.Where("user_id = ?", userId).Order("id desc").Find(&headers).Error
	return
}

func GetInvoiceHeaderById(id int, userId int) (*InvoiceHeader, error) {
	var header InvoiceHeader
	err := DB.Where("id = ? AND user_id = ?", id, userId).First(&header).Error
	if err != nil {
		return nil, err
	}
	return &header, nil
}

func CreateInvoiceHeader(header *InvoiceHeader) error {
	return DB.Create(header).Error
}

func DeleteInvoiceHeader(id int, userId int) error {
	result := DB.Where("id = ? AND user_id = ?", id, userId).Delete(&InvoiceHeader{})
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return result.Error
}

func GetInvoiceRequestsByUserId(userId int) (requests []InvoiceRequest, err error) {
	err = DB.Where("user_id = ?", userId).Order("id desc").Find(&requests).Error
	return
}

func CreateInvoiceRequest(request *InvoiceRequest) error {
	return DB.Create(request).Error
}

// GetInvoicedOrderIds returns all order trade_no values that have been included in
// any invoice request by the given user.
func GetInvoicedOrderIds(userId int) ([]string, error) {
	var requests []InvoiceRequest
	err := DB.Select("order_ids").Where("user_id = ?", userId).Find(&requests).Error
	if err != nil {
		return nil, err
	}

	var allIds []string
	for _, r := range requests {
		var ids []string
		if e := common.UnmarshalJsonStr(r.OrderIds, &ids); e == nil {
			allIds = append(allIds, ids...)
		}
	}
	return allIds, nil
}

// GetInvoicedOrderStatuses returns a map of order trade_no -> invoice request status
// ("pending" while awaiting admin processing, "completed" once the admin has issued
// the invoice). When an order appears in multiple requests, "completed" wins.
func GetInvoicedOrderStatuses(userId int) (map[string]string, error) {
	var requests []InvoiceRequest
	err := DB.Select("order_ids, status").Where("user_id = ?", userId).Find(&requests).Error
	if err != nil {
		return nil, err
	}

	statuses := make(map[string]string)
	for _, r := range requests {
		var ids []string
		if e := common.UnmarshalJsonStr(r.OrderIds, &ids); e != nil {
			continue
		}
		for _, id := range ids {
			if statuses[id] == "completed" {
				continue
			}
			statuses[id] = r.Status
		}
	}
	return statuses, nil
}

func GetAllInvoiceRequests(pageInfo *common.PageInfo) (results []InvoiceRequestDetail, total int64, err error) {
	err = DB.Model(&InvoiceRequest{}).Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	var requests []InvoiceRequest
	err = DB.Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&requests).Error
	if err != nil {
		return nil, 0, err
	}

	userIds := make([]int, 0, len(requests))
	headerIds := make([]int, 0, len(requests))
	for _, r := range requests {
		userIds = append(userIds, r.UserId)
		headerIds = append(headerIds, r.HeaderId)
	}

	userMap := make(map[int]string)
	if len(userIds) > 0 {
		var users []User
		DB.Select("id, username").Where("id IN ?", userIds).Find(&users)
		for _, u := range users {
			userMap[u.Id] = u.Username
		}
	}

	headerMap := make(map[int]*InvoiceHeader)
	if len(headerIds) > 0 {
		var headers []InvoiceHeader
		DB.Where("id IN ?", headerIds).Find(&headers)
		for i := range headers {
			headerMap[headers[i].Id] = &headers[i]
		}
	}

	for _, r := range requests {
		results = append(results, InvoiceRequestDetail{
			InvoiceRequest: r,
			Username:       userMap[r.UserId],
			Header:         headerMap[r.HeaderId],
		})
	}
	return results, total, nil
}

func UpdateInvoiceRequestStatus(id int, status string, note string) error {
	return DB.Model(&InvoiceRequest{}).Where("id = ?", id).Updates(map[string]interface{}{
		"status": status,
		"note":   note,
	}).Error
}

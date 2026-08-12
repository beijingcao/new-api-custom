package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestUpdateOptionMapUpdatesReceiptVisibility(t *testing.T) {
	previousOptionMap := common.OptionMap
	previousReceiptEnabled := common.ReceiptEnabled
	common.OptionMap = map[string]string{}
	common.ReceiptEnabled = true
	t.Cleanup(func() {
		common.OptionMap = previousOptionMap
		common.ReceiptEnabled = previousReceiptEnabled
	})

	require.NoError(t, updateOptionMap("ReceiptEnabled", "false"))
	require.False(t, common.ReceiptEnabled)
	require.Equal(t, "false", common.OptionMap["ReceiptEnabled"])

	require.NoError(t, updateOptionMap("ReceiptEnabled", "true"))
	require.True(t, common.ReceiptEnabled)
	require.Equal(t, "true", common.OptionMap["ReceiptEnabled"])
}

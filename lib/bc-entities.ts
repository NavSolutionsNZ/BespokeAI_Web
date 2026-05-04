/**
 * BC 14 OData entity catalogue.
 * Used to build the system prompt for the query-planner Claude call.
 * Entity names must match the exact OData endpoint names in BC.
 */

export const BC_ENTITIES = {
  // --- Customers & Sales ---
  Customer: {
    description: 'Customers / debtors / clients. To find overdue/outstanding debtors use $filter=Balance_LCY gt 0. No Due_Date field exists on Customer.',
    keyField: 'No',
    usefulFields: [
      'No', 'Name', 'Balance_LCY', 'Credit_Limit_LCY',
      'Phone_No', 'E_Mail', 'City', 'Country_Region_Code',
      'Payment_Terms_Code', 'Salesperson_Code',
    ],
  },
  SalesOrder: {
    description: 'Open (unposted) sales orders',
    keyField: 'No',
    usefulFields: [
      'No', 'Sell_to_Customer_No', 'Sell_to_Customer_Name',
      'Order_Date', 'Amount', 'Amount_Including_VAT', 'Status',
      'Requested_Delivery_Date',
    ],
  },
  SalesOrderSalesLines: {
    description: 'Sales order lines — individual line items on sales orders',
    keyField: 'Document_No',
    usefulFields: [
      'Document_No', 'Line_No', 'Type', 'No', 'Description',
      'Quantity', 'Unit_Price', 'Line_Amount',
    ],
  },
  SalesInvoice: {
    description: 'Posted sales invoice headers — dates, customer, payment terms only. Has NO amount fields. Use SalesInvoiceSalesLines for amounts.',
    keyField: 'No',
    usefulFields: [
      'No', 'Sell_to_Customer_No', 'Sell_to_Customer_Name',
      'Posting_Date', 'Document_Date', 'Due_Date',
      'Payment_Terms_Code', 'Payment_Method_Code', 'Salesperson_Code', 'Currency_Code',
    ],
  },
  SalesInvoiceSalesLines: {
    description: 'Posted sales invoice lines — has Amount_Including_VAT and Line_Amount but NO Posting_Date. Join Document_No to SalesInvoice.No to get dates.',
    keyField: 'Document_No',
    usefulFields: [
      'Document_No', 'Line_No', 'Type', 'No', 'Description',
      'Quantity', 'Unit_Price', 'Line_Amount', 'Amount', 'Amount_Including_VAT',
    ],
  },
  SalesCrMemo: {
    description: 'Posted sales credit memo headers — dates and customer only. No amount fields. Use SalesCrMemoSalesLines for amounts.',
    keyField: 'No',
    usefulFields: [
      'No', 'Sell_to_Customer_No', 'Sell_to_Customer_Name',
      'Posting_Date', 'Document_Date', 'Payment_Terms_Code', 'Currency_Code',
    ],
  },
  SalesCrMemoSalesLines: {
    description: 'Sales credit memo lines — has Line_Amount but NO Posting_Date. Join Document_No to SalesCrMemo.No to get dates.',
    keyField: 'Document_No',
    usefulFields: [
      'Document_No', 'Line_No', 'No', 'Description',
      'Quantity', 'Unit_Price', 'Line_Amount', 'Amount_Including_VAT',
    ],
  },

  // --- Vendors & Purchasing ---
  Vendor: {
    description: 'Vendors / suppliers / creditors',
    keyField: 'No',
    usefulFields: [
      'No', 'Name', 'Balance_LCY', 'Phone_No', 'E_Mail',
      'City', 'Country_Region_Code', 'Payment_Terms_Code',
    ],
  },
  PurchaseOrder: {
    description: 'Open (unposted) purchase orders',
    keyField: 'No',
    usefulFields: [
      'No', 'Buy_from_Vendor_No', 'Buy_from_Vendor_Name',
      'Order_Date', 'Amount', 'Amount_Including_VAT', 'Status',
      'Expected_Receipt_Date',
    ],
  },
  PurchaseOrderPurchLines: {
    description: 'Purchase order lines — individual line items on purchase orders',
    keyField: 'Document_No',
    usefulFields: [
      'Document_No', 'Line_No', 'Type', 'No', 'Description',
      'Quantity', 'Direct_Unit_Cost', 'Line_Amount',
    ],
  },
  PurchaseInvoice: {
    description: 'Posted purchase invoice headers — dates and vendor only. No amount fields. Use PurchaseInvoicePurchLines for amounts.',
    keyField: 'No',
    usefulFields: [
      'No', 'Buy_from_Vendor_No', 'Buy_from_Vendor_Name',
      'Posting_Date', 'Document_Date', 'Due_Date',
      'Payment_Terms_Code', 'Currency_Code',
    ],
  },
  PurchaseInvoicePurchLines: {
    description: 'Posted purchase invoice lines — has Line_Amount but NO Posting_Date. Join Document_No to PurchaseInvoice.No to get dates.',
    keyField: 'Document_No',
    usefulFields: [
      'Document_No', 'Line_No', 'No', 'Description',
      'Quantity', 'Direct_Unit_Cost', 'Line_Amount', 'Amount', 'Amount_Including_VAT',
    ],
  },

  // --- Inventory ---
  Item: {
    description: 'Inventory items / products / stock / parts / vehicles',
    keyField: 'No',
    usefulFields: [
      'No', 'Description', 'Unit_Price', 'Unit_Cost',
      'Inventory', 'Item_Category_Code', 'Vendor_No',
      'Base_Unit_of_Measure',
    ],
  },

  // --- Finance ---
  GeneralLedgerEntry: {
    description: 'General ledger entries / GL entries / journal entries / accounting transactions',
    keyField: 'Entry_No',
    usefulFields: [
      'Entry_No', 'G_L_Account_No', 'Posting_Date', 'Document_Date',
      'Description', 'Amount', 'Document_No', 'Document_Type',
      'Source_Type', 'Source_No',
    ],
  },

  // --- Service ---
  ServiceInvoiceLines: {
    description: 'Service invoice lines — service department billing lines',
    keyField: 'Document_No',
    usefulFields: [
      'Document_No', 'Line_No', 'Type', 'No', 'Description',
      'Quantity', 'Unit_Price', 'Line_Amount', 'Posting_Date',
    ],
  },
} as const

export type BCEntityName = keyof typeof BC_ENTITIES

/** Returns a formatted string for Claude's system prompt */
export function getEntitiesSummary(): string {
  return Object.entries(BC_ENTITIES)
    .map(([name, info]) =>
      `  - ${name}: ${info.description}\n    Fields: ${info.usefulFields.join(', ')}`)
    .join('\n')
}

/** Returns selected fields for a given entity (for $select hint) */
export function getEntityFields(entity: BCEntityName): string[] {
  return [...BC_ENTITIES[entity].usefulFields] as string[]
}

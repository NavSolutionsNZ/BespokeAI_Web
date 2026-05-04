/**
 * BC 14 OData entity catalogue.
 * Used to build the system prompt for the query-planner Claude call.
 * Entity names must match the exact OData endpoint names in BC.
 */

export const BC_ENTITIES = {
  // --- Customers & Sales ---
  Customer: {
    description: 'Customers / debtors / clients. To find overdue/outstanding debtors use $filter=Balance_LCY gt 0 — there is NO Due_Date, no Overdue field. Balance_LCY is the outstanding amount.',
    keyField: 'No',
    usefulFields: [
      'No', 'Name', 'Balance_LCY', 'Sales_LCY', 'Credit_Limit_LCY',
      'Phone_No', 'Mobile_Phone_No', 'E_Mail',
      'Address', 'City', 'Post_Code', 'Country_Region_Code',
      'Payment_Terms_Code', 'Payment_Method_Code', 'Salesperson_Code',
      'Blocked', 'Creation_Date', 'Last_Date_Modified', 'VAT_Registration_No',
    ],
  },
  SalesOrder: {
    description: 'Open (unposted) sales orders — header only, no Amount fields. Use SalesOrderSalesLines for amounts. Status_Code not Status.',
    keyField: 'No',
    usefulFields: [
      'No', 'Sell_to_Customer_No', 'Sell_to_Customer_Name',
      'Order_Date', 'Posting_Date', 'Due_Date', 'Shipment_Date',
      'Status_Code', 'Salesperson_Code', 'Payment_Terms_Code',
      'Location_Code', 'Shortcut_Dimension_1_Code', 'Shortcut_Dimension_2_Code',
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
    description: 'Vendors / suppliers / creditors. To find vendors with outstanding AP use $filter=Balance_LCY gt 0. No Due_Date field on Vendor.',
    keyField: 'No',
    usefulFields: [
      'No', 'Name', 'Balance_LCY', 'Purchases_LCY',
      'Phone_No', 'Mobile_Phone_No', 'E_Mail',
      'Address', 'City', 'Post_Code', 'Country_Region_Code',
      'Payment_Terms_Code', 'Payment_Method_Code', 'Purchaser_Code',
      'Blocked', 'Last_Date_Modified', 'VAT_Registration_No', 'No_of_Documents',
    ],
  },
  PurchaseOrder: {
    description: 'Open (unposted) purchase orders — header only, no Amount fields. Use PurchaseOrderPurchLines for amounts. Status_Code not Status.',
    keyField: 'No',
    usefulFields: [
      'No', 'Buy_from_Vendor_No', 'Buy_from_Vendor_Name',
      'Order_Date', 'Posting_Date', 'Due_Date', 'Expected_Receipt_Date',
      'Status_Code', 'Purch_Order_Type', 'Purchaser_Code', 'Payment_Terms_Code',
      'Location_Code', 'Shortcut_Dimension_1_Code',
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
    description: 'Inventory items / products / stock / parts / vehicles. Blocked is boolean (false=active). No Item_Category_Code field.',
    keyField: 'No',
    usefulFields: [
      'No', 'Description', 'Make_Code', 'Item_Group_Code',
      'Unit_Price', 'Unit_Price_incl_VAT', 'Unit_Cost', 'Last_Direct_Cost',
      'Inventory', 'Vendor_No', 'Base_Unit_of_Measure',
      'Blocked', 'Creation_Date', 'Last_Date_Modified',
      'Inventory_Posting_Group', 'Gen_Prod_Posting_Group',
    ],
  },

  // --- Finance ---
  GeneralLedgerEntry: {
    description: 'Financial general ledger entries — debits, credits, account postings. Use for P&L, budget vs actual, cost centre analysis, VAT. Has G_L_Account_No, G_L_Account_Name, Debit_Amount, Credit_Amount. Posting_Date is a bare date — do not use $filter on it.',
    keyField: 'Entry_No',
    usefulFields: [
      'Entry_No', 'Transaction_No', 'Posting_Date', 'Register_Date',
      'Document_Type', 'Document_No', 'External_Document_No',
      'G_L_Account_No', 'G_L_Account_Name', 'Description',
      'Amount', 'Debit_Amount', 'Credit_Amount', 'VAT_Amount',
      'Source_Type', 'Source_No',
      'Global_Dimension_1_Code', 'Global_Dimension_2_Code', 'Branch_Code',
      'Gen_Posting_Type', 'Gen_Bus_Posting_Group', 'Gen_Prod_Posting_Group',
      'Reversed', 'Source_Code', 'Reason_Code',
    ],
  },

  // --- Item Ledger ---
  ItemLedgerEntry: {
    description: 'Item ledger entries — physical inventory movements (vehicle/parts purchases and sales). Entry_Type is Purchase or Sale. Amount is cost value. Use for stock movement, vehicle sales history, inventory cost by item.',
    keyField: 'Entry_No',
    usefulFields: [
      'Entry_No', 'Posting_Date', 'Entry_Type', 'Document_No',
      'Item_No', 'Description', 'Amount', 'Adjusted_Cost',
      'Quantity', 'Invoiced_Quantity', 'Remaining_Quantity',
      'Location_Code', 'Global_Dimension_1_Code', 'Global_Dimension_2_Code',
      'Serial_No', 'VIN', 'Open',
      'Salespers_Purch_Code', 'Source_No_Payment', 'Main_Area',
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

/**
 * BC 14 OData entity catalogue.
 * Used to build the system prompt for the query-planner Claude call.
 * Entity names must match the exact OData endpoint names in BC.
 */

export const BC_ENTITIES = {
  // --- Customers & Sales ---
  Customer: {
    description: 'Customers / debtors / clients',
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
  SalesInvoice: {
    description: 'Posted sales invoices',
    keyField: 'No',
    usefulFields: [
      'No', 'Sell_to_Customer_No', 'Sell_to_Customer_Name',
      'Posting_Date', 'Due_Date', 'Amount', 'Amount_Including_VAT',
    ],
  },
  SalesCrMemo: {
    description: 'Posted sales credit memos / credit notes',
    keyField: 'No',
    usefulFields: [
      'No', 'Sell_to_Customer_No', 'Sell_to_Customer_Name',
      'Posting_Date', 'Amount', 'Amount_Including_VAT',
    ],
  },
  SalesShipment: {
    description: 'Posted sales shipments / deliveries',
    keyField: 'No',
    usefulFields: [
      'No', 'Sell_to_Customer_No', 'Sell_to_Customer_Name',
      'Posting_Date', 'Shipment_Method_Code',
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
  PurchaseInvoice: {
    description: 'Posted purchase invoices',
    keyField: 'No',
    usefulFields: [
      'No', 'Buy_from_Vendor_No', 'Buy_from_Vendor_Name',
      'Posting_Date', 'Due_Date', 'Amount', 'Amount_Including_VAT',
    ],
  },
  PurchCrMemo: {
    description: 'Posted purchase credit memos',
    keyField: 'No',
    usefulFields: [
      'No', 'Buy_from_Vendor_No', 'Posting_Date', 'Amount',
    ],
  },

  // --- Inventory ---
  Item: {
    description: 'Inventory items / products / stock / parts',
    keyField: 'No',
    usefulFields: [
      'No', 'Description', 'Unit_Price', 'Unit_Cost',
      'Inventory', 'Item_Category_Code', 'Vendor_No',
      'Base_Unit_of_Measure',
    ],
  },
  ItemLedgerEntry: {
    description: 'Item ledger entries — stock movements / inventory transactions',
    keyField: 'Entry_No',
    usefulFields: [
      'Entry_No', 'Item_No', 'Posting_Date', 'Entry_Type',
      'Quantity', 'Location_Code', 'Document_No',
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
  GLAccount: {
    description: 'Chart of accounts / GL accounts',
    keyField: 'No',
    usefulFields: [
      'No', 'Name', 'Account_Type', 'Net_Change',
      'Balance_at_Date', 'Income_Balance',
    ],
  },
  CustomerLedgerEntry: {
    description: 'Customer ledger entries / debtor transactions / outstanding invoices / receivables',
    keyField: 'Entry_No',
    usefulFields: [
      'Entry_No', 'Customer_No', 'Posting_Date', 'Document_Type',
      'Document_No', 'Amount', 'Remaining_Amount', 'Due_Date', 'Open',
    ],
  },
  VendorLedgerEntry: {
    description: 'Vendor ledger entries / creditor transactions / outstanding purchase invoices / payables',
    keyField: 'Entry_No',
    usefulFields: [
      'Entry_No', 'Vendor_No', 'Posting_Date', 'Document_Type',
      'Document_No', 'Amount', 'Remaining_Amount', 'Due_Date', 'Open',
    ],
  },
} as const

export type BCEntityName = keyof typeof BC_ENTITIES

/** Returns a formatted string for Claude's system prompt */
export function getEntitiesSummary(): string {
  return Object.entries(BC_ENTITIES)
    .map(([name, info]) => `  - ${name}: ${info.description}`)
    .join('\n')
}

/** Returns selected fields for a given entity (for $select hint) */
export function getEntityFields(entity: BCEntityName): string[] {
  return [...BC_ENTITIES[entity].usefulFields] as string[]
}

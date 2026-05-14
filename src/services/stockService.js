import { recordSale as fbRecordSale, recordRestock as fbRecordRestock } from './firebaseService';
import { validateSaleForm, validateRestockForm } from '../utils/validators';

export async function processSale(customerName, items, billingStatus = 'unbilled') {
  const { valid, errors } = validateSaleForm(customerName, items);
  if (!valid) throw new Error(Object.values(errors)[0]);
  const saleItems = items.map(({ productName, qty }) => ({ productName, qty: Number(qty) }));
  await fbRecordSale(customerName.trim(), saleItems, billingStatus);
}

export async function processRestock(productName, qty, remarks = '') {
  const { valid, errors } = validateRestockForm(productName, qty);
  if (!valid) throw new Error(Object.values(errors)[0]);
  await fbRecordRestock(productName.trim(), Number(qty), remarks.trim());
}
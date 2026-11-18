const { WorkOrder } = require('../../models');
const { ApiError } = require('../middleware/errors');

const FIRST_ORDER_NUMBER = 1001;
const MAX_ATTEMPTS = 5;

// Highest number used so far (WO-1005 -> 1005). Compared as numbers, because as text "WO-999" sorts after "WO-1000".
async function highestOrderNumber() {
  const [result] = await WorkOrder.aggregate([
    { $project: { n: { $toInt: { $substrCP: ['$orderNumber', 3, 20] } } } },
    { $group: { _id: null, max: { $max: '$n' } } }
  ]);
  return result ? result.max : 0;
}

function isDuplicateOrderNumber(err) {
  return err.code === 11000 && Boolean(err.keyPattern && err.keyPattern.orderNumber);
}

// Simple approach: take the highest number and add 1. Two people saving at the same moment
// can pick the same number, but the unique index on orderNumber makes the database refuse the
// second one. We catch that refusal and try again with a fresh highest number.
async function createWorkOrder(fields) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const next = Math.max(await highestOrderNumber() + 1, FIRST_ORDER_NUMBER);
    try {
      return await WorkOrder.create({ ...fields, orderNumber: `WO-${next}` });
    } catch (err) {
      if (!isDuplicateOrderNumber(err)) throw err;
    }
  }
  throw new ApiError(503, 'ORDER_NUMBER_BUSY', 'Could not reserve an order number, please try again');
}

module.exports = { createWorkOrder, highestOrderNumber };

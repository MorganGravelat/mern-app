// Lets other files write: const { User, WorkOrder } = require('./models');
module.exports = {
  User: require('./User'),
  WorkOrder: require('./WorkOrder')
};

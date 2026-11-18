// So other files can do: const { User, WorkOrder } = require('./models');
module.exports = {
  User: require('./User'),
  WorkOrder: require('./WorkOrder')
};

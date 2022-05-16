import { Sequelize, Model, DataTypes } from "sequelize";
const sequelize = new Sequelize({
  database: "d9dfetrv38110r",
  host: "ec2-52-3-2-245.compute-1.amazonaws.com",
  port: 5432,
  username: "paikimzbhjuioq",
  password: "249471ce3018e1b1727e55b7d78bb3d1aac364d1e018603edd0d7446baea8ad9",
  dialect: "postgres",
  ssl: true,
  dialectOptions: {
    ssl: {
      rejectUnauthorized: false,
    },
  },
});

//postgres://rrzauscvbwkqoe:63afda89b6294ebc3af594e3b20348a331fc80bc5cc1c05e11cc5482fc3b63f8@ec2-3-230-199-240.compute-1.amazonaws.com:5432/d5epbrua0mo9ae
class Configuration extends Model {}
class Billing extends Model {}

Configuration.init(
  {
    storeID: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true
    },
    firstLetter: DataTypes.STRING(10),
    middleLetter: DataTypes.STRING(10),
    lastLetter: DataTypes.STRING(10),
    delimiter: DataTypes.SMALLINT,
    rulesRange: DataTypes.SMALLINT,
    productRange: DataTypes.SMALLINT,
    productOptions: DataTypes.SMALLINT,
    collectId: DataTypes.STRING,
    ids: {
      allowNull: true,
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: null,
    },
    lastGen: DataTypes.INTEGER
  },
  { sequelize, modelName: "skugen", id: false }
);
Billing.init(
  {
    storeID: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true
    },
    charge_id: DataTypes.STRING,
    subscription_id: DataTypes.STRING,
    name: DataTypes.STRING,
    price: DataTypes.FLOAT,
    status: DataTypes.STRING,
    billing_on: DataTypes.STRING,
    activated_on: DataTypes.STRING,
    cancelled_on: DataTypes.STRING,
    trial_days: DataTypes.SMALLINT,
    trial_ends_on: DataTypes.STRING,
  },
  { sequelize, modelName: "billings", id: false }
);
sequelize
  .sync()
  .then()
  .catch((err) => console.log("sync error", err));

// export const insert = async (data) => {
//   const jane = await Configuration.create(data);
//   // console.log(jane.toJSON());
//   return jane.toJSON();
// };

// Config table
export const upsert = (values) => {
  return Configuration.findOne({ where: { storeID: values.storeID } }).then(function (obj) {
    // update
    if (obj) return obj.update(values);
    // insert
    return Configuration.create(values);
  });
};

export const queryId = async (storeId) => {
  return Configuration.findOne({ where: { storeID: storeId } });
};

// billing table

export const upsertBilling = (values) => {
  return Billing.findOne({ where: { storeID: values.storeID } }).then(function (obj) {
    // update
    if (obj) return obj.update(values);
    // insert
    return Billing.create(values);
  });
};

export const queryBilling = async (storeId) => {
  try {
    return Billing.findOne({where: {storeID: storeId}})
  } catch (err) {
    return {}
  }
}

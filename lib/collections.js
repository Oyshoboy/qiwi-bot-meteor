import { Mongo } from 'meteor/mongo';

export const Users = new Mongo.Collection('Users');
export const QiwiWallets = new Mongo.Collection('QiwiWallets');
export const PaymentsHistory = new Mongo.Collection('PaymentsHistory');

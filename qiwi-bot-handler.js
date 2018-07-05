import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import { Users, QiwiWallets, PaymentsHistory } from '/lib/collections';

const Telegraf = require('telegraf');
const Qiwi = require('node-qiwi-api').Qiwi;
const MyBot = new Telegraf("[TELEGRAM TOKEN HERE]");
const bound = Meteor.bindEnvironment((callback) => { callback(); });

Meteor.startup(() => {
    var startText = "You don't have any Qiwi Tokens added.\nYou can create one here - [Qiwi Token Page](https://qiwi.com/api)\n\nThen send me your Qiwi API token to begin 😏. \n\n"
    var todoText = "Use these commands:\n/qiwibalance - to get your Qiwi balances\n/qiwisend - to send money";
    var addWalletText = "You can create token here - [Qiwi Token Page](https://qiwi.com/api)\n\nThen send me your Qiwi API token to begin 😏. \n\n"

    const aboutMenu = Telegraf.Extra
        .markdown()
        .markup((m) => m.keyboard([
            m.callbackButton('My Wallets'),
            m.callbackButton('Add Wallet'),
            // m.callbackButton('⬅️ Back')
        ]).resize())

    const cancel = Telegraf.Extra
        .markdown()
        .markup((m) => m.keyboard([
            m.callbackButton('Cancel')
        ]).resize())

    MyBot.start((ctx) => {
        if (checkIfUserHaveWallets(ctx)) { // WALLETS FOUND
            ctx.replyWithMarkdown("Start menu:", aboutMenu);
        } else { // WALLETS NOT FOUND, NEED TO CREATE
            if (checkOrSaveUser(ctx)[0]) {
                ctx.replyWithMarkdown(`Welcome back ${ctx.message.from.first_name} 👋\n\n` + startText);
            } else {
                ctx.replyWithMarkdown(`Sup ${ctx.message.from.first_name}, glad to see you here 🤙\n\n` + startText);
            }
        }
    });

    MyBot.hears("Cancel", (ctx) => {
        Users.update({ "chatId": ctx.chat.id }, { $set: { "currentWallet": false, "sendingMoney": false } });
        ctx.replyWithMarkdown("Operation canceled", aboutMenu);
    });

    MyBot.command("test", (ctx) => {
        //ctx.reply('test message', testMenu);
        ctx.reply('Start Menu:', aboutMenu);
    });

    MyBot.hears("Add Wallet", (ctx) => {
        ctx.replyWithMarkdown(addWalletText);
    });

    MyBot.hears("⬅️ Back", (ctx) => {
        fallBack(ctx);
    });

    MyBot.hears("⬅️ Back to start menu", (ctx) => {
        Users.update({ "chatId": ctx.chat.id }, { $set: { "currentWallet": false } });
        ctx.replyWithMarkdown("Start menu:", aboutMenu);
    });


    MyBot.hears("Balance", (ctx) => {
        if (checkIfUserHaveWallets(ctx)) {
            var currentNumber = Users.findOne({ "chatId": ctx.chat.id }).currentWallet;
            currentNumber = QiwiWallets.findOne({ "qiwiNum": currentNumber });
            qiwiBalanceByToken(ctx, currentNumber.token);
        } else {
            fallBack(ctx);
        }
    });

    MyBot.hears("History", (ctx) => {
        if (checkIfUserHaveWallets(ctx)) {
            var currentNumber = Users.findOne({ "chatId": ctx.chat.id }).currentWallet;
            currentNumber = QiwiWallets.findOne({ "qiwiNum": currentNumber });
            qiwiHistoryByToken(ctx, currentNumber.token);
        } else {
            fallBack(ctx);
        }
    });

    MyBot.hears("Send money to Qiwi", (ctx) => {
        if (checkIfUserHaveWallets(ctx)) {
            ctx.replyWithMarkdown("Alright! Give me Qiwi number and amount to send (in RUB)\n\nExample: `+79619062143 500`", cancel);
            Users.update({ "chatId": ctx.chat.id }, { $set: { "sendingMoney": 1 } });
        } else {
            fallBack(ctx);
        }
    });

    MyBot.hears("Send money to Card", (ctx) => {
        if (checkIfUserHaveWallets(ctx)) {
            ctx.replyWithMarkdown("Coming soon..."); //"Alright! Give me Card number and amount to send (in RUB)\n\nExample: `4617128810710320 500`", cancel);
            //Users.update({ "chatId": ctx.chat.id }, { $set: { "sendingMoney": 1 } });
        } else {
            fallBack(ctx);
        }
    });

    MyBot.hears("⬅️ Back to wallets", (ctx) => {
        if (checkIfUserHaveWallets(ctx)) {
            Users.update({ "chatId": ctx.chat.id }, { $set: { "currentWallet": false } });
            var functionsArr = [];
            for (var i = checkIfUserHaveWallets(ctx).fetch().length - 1; i >= 0; i--) {
                functionsArr.push("" + checkIfUserHaveWallets(ctx).fetch()[i].qiwiNum);
            }

            //functionsArr = functionsArr.toString().replace(/\(\) => /g, "");
            console.log(functionsArr);

            functionsArr.push('⬅️ Back to start menu');

            walletsList = Telegraf.Extra
                .markdown()
                .markup((m) => m.keyboard(functionsArr).resize())

            ctx.reply('Your wallets:', walletsList);
        } else {
            fallBack(ctx);
        }
    });

    MyBot.hears("My Wallets", (ctx) => {
        if (checkIfUserHaveWallets(ctx)) {
            var functionsArr = [];
            for (var i = checkIfUserHaveWallets(ctx).fetch().length - 1; i >= 0; i--) {
                functionsArr.push("" + checkIfUserHaveWallets(ctx).fetch()[i].qiwiNum);
            }

            //functionsArr = functionsArr.toString().replace(/\(\) => /g, "");
            console.log(functionsArr);

            functionsArr.push('⬅️ Back to start menu');

            walletsList = Telegraf.Extra
                .markdown()
                .markup((m) => m.keyboard(functionsArr).resize())

            ctx.reply('Your wallets:', walletsList);
        } else {
            fallBack(ctx);
        }
    });

    MyBot.command("qiwibalance", (ctx) => {
        if (checkIfUserHaveWallets(ctx)) {
            var currenQiwinum = "empty";
            var Wallet = new Qiwi(checkIfUserHaveWallets(ctx).fetch()[0].token);
            Wallet.getAccountInfo((err, info) => {
                if (err) {
                    /*hanle error*/
                }
                console.log("Qiwi account:", info.authInfo.personId);
                currenQiwinum = info.authInfo.personId;
                // ctx.replyWithMarkdown('Alright! Getting balances for: `+' + info.authInfo.personId + '`').then(() => {
                Wallet.getBalance((err, balance) => {
                    if (err) {
                        /*hanle error*/
                        console.log(err);
                    } else {
                        //var totalBalance = 0;
                        var finalAnswerMessage = "Your current balances for: `+" + currenQiwinum + "`";
                        for (var i = balance.accounts.length - 1; i >= 0; i--) {
                            var resultBalance = 0;
                            if (balance.accounts[i].balance) {
                                resultBalance = balance.accounts[i].balance.amount;
                            }

                            if (balance.accounts[i].alias == "qw_wallet_rub") {
                                finalAnswerMessage += ("\n `" + resultBalance + "` RUB");
                            } else if (balance.accounts[i].alias == "qw_wallet_usd") {
                                finalAnswerMessage += ("\n `" + resultBalance + "` USD");
                            } else if (balance.accounts[i].alias == "qw_wallet_eur") {
                                finalAnswerMessage += ("\n `" + resultBalance + "` EUR");
                            } else if (balance.accounts[i].alias == "qw_wallet_kzt") {
                                finalAnswerMessage += ("\n `" + resultBalance + "` KZT");
                            }
                            console.log("the " + balance.accounts[i].alias + " balance is: " + resultBalance);
                            //totalBalance += parseFloat(resultBalance);
                        }
                        ctx.replyWithMarkdown(finalAnswerMessage);
                    }
                });
                // });
            });
        } else {
            ctx.replyWithMarkdown(startText);
            return
        }
    });

    MyBot.on('text', (ctx) => {
        if (checkIfUserHaveWallets(ctx)) {
            console.log("NUBMER IS:" + ctx.message.text.replace("+", ""));
            if (checkOrSaveUser(ctx)[1].sendingMoney) {
                var message = ctx.message.text.replace("+", "").split(" ");
                console.log(message);
                if (/^\d+$/.test(message[0]) && /^\d+$/.test(message[1]) && message[0].length >= 9 && message[0].length <= 15 && parseFloat(message[1]) <= 14500) {
                    console.log("alright, can send money!");

                    var currentNumber = Users.findOne({ "chatId": ctx.chat.id }).currentWallet;
                    currentNumber = QiwiWallets.findOne({ "qiwiNum": currentNumber });
                    var Wallet = new Qiwi(currentNumber.token);

                    Wallet.toWallet({ amount: message[1], comment: ('Money Sent ' + checkOrSaveUser(ctx)[1].shortId), account: '+' + message[0] }, (err, data) => {
                        bound(() => {
                            if (err) {
                                /* handle err*/
                                ctx.reply("❌ Damn! There is an error while processing.", cancel);
                                console.log(err);
                            } else {
                                console.log("success, money sent!");
                                console.log(data);
                                if (data.id != undefined) {
                                    Users.update({ "chatId": ctx.chat.id }, { $set: { "sendingMoney": false } });
                                    PaymentsHistory.insert({ "date": Date.now(), "owner": ctx.chat.id, "transactionId": data.transaction.id, "amount": message[1], "from": currentNumber.qiwiNum, "to": message[0], "tokenUsed": currentNumber.token });
                                    ctx.replyWithMarkdown("✅ Done! " + message[1] + " RUB successfully sent to the: +" + message[0] + '\nTransaction ID: `' + data.transaction.id + '`', aboutMenu);
                                    qiwiBalanceByToken(ctx, currentNumber.token);
                                } else {
                                    ctx.replyWithMarkdown("❌ Damn! There is an error while processing:\n`" + data.code + " - " + data.message + "`", cancel);
                                }
                            }
                        });
                    });
                } else {
                    ctx.reply("something wrong with your request :(", cancel);
                }
            } else if (/^\d+$/.test(ctx.message.text) && ctx.message.text.length >= 9 && ctx.message.text.length <= 15 && checkUsersMobilePhone(ctx, ctx.message.text)) { // only numbers , suitable lenght, and client is owner

                Users.update({ "chatId": ctx.chat.id }, { $set: { "currentWallet": parseInt(ctx.message.text) } });
                const walletMenu = Telegraf.Extra
                    .markdown()
                    .markup((m) => m.keyboard([
                        m.callbackButton('Balance'),
                        m.callbackButton('History'),
                        m.callbackButton('Send money to Qiwi'),
                        //m.callbackButton('Send money to Card'),
                        m.callbackButton('⬅️ Back to wallets')
                    ]).resize())

                ctx.reply('Wallet Menu:', walletMenu);
            } else {
                var message = ctx.message.text.replace(/[^a-z0-9]/gi, '');
                if (message.length != 32) {
                    ctx.replyWithMarkdown(`Hmmm... it's not looks like a API Token ☹️\nYou can create one here - [Qiwi Token Page](https://qiwi.com/api)`);
                } else {
                    var Wallet = new Qiwi(message);
                    Wallet.getAccountInfo((err, info) => {
                        bound(() => {
                            if (err) {
                                ctx.replyWithMarkdown(`Oops! Error occurred! Try again in a few minutes ☹️`);
                            } else if (info == undefined) {
                                ctx.replyWithMarkdown(`❌ Oops! Your token is invalid. Try another one.`);
                            } else {
                                var tokenAddedBefore = QiwiWallets.findOne({ "owner": ctx.chat.id, "token": message });
                                if (tokenAddedBefore == undefined) {
                                    currenQiwinum = info.authInfo.personId;
                                    QiwiWallets.insert({ "date": Date.now(), "owner": ctx.chat.id, "token": message, "qiwiNum": currenQiwinum });
                                    ctx.replyWithMarkdown('✅ Done! Your token is valid!\nQiwi Wallet `+' + currenQiwinum + '` successfully added 😊', aboutMenu);
                                } else {
                                    ctx.replyWithMarkdown('❌ Oops! You already added this token. Try another one.');
                                }
                            }
                        });
                    });
                }
            }
        } else {
            var message = ctx.message.text.replace(/[^a-z0-9]/gi, '');
            if (message.length != 32) {
                ctx.replyWithMarkdown(`Hmmm... it's not looks like a API Token ☹️\nYou can create one here - [Qiwi Token Page](https://qiwi.com/api)`);
            } else {
                var Wallet = new Qiwi(message);
                Wallet.getAccountInfo((err, info) => {
                    bound(() => {
                        if (err) {
                            ctx.replyWithMarkdown(`Oops! Error occurred! Try again in a few minutes ☹️`);
                        } else if (info == undefined) {
                            ctx.replyWithMarkdown(`❌ Oops! Your token is invalid. Try another one.`);
                        } else {
                            currenQiwinum = info.authInfo.personId;
                            QiwiWallets.insert({ "date": Date.now(), "owner": ctx.chat.id, "token": message, "qiwiNum": currenQiwinum });
                            ctx.replyWithMarkdown('✅ Done! Your token is valid!\nQiwi Wallet `+' + currenQiwinum + '` successfully added 😊', aboutMenu);
                        }
                    });
                });
                console.log("JA");
            }
        }
    });

    MyBot.startPolling();
});

//FUNCTIONS 

function checkUsersMobilePhone(ctx, number) {
    var AnyWallets = QiwiWallets.findOne({ "qiwiNum": parseInt(number), "owner": ctx.chat.id });
    if (AnyWallets != undefined) {
        console.log("owns");
        return true;
    } else {
        console.log("not owns");
        return false;
    }
}

function QiwiResponseErrorHandler() {
    var allErrors = [
        [0, "OK"],
        [3, "Техническая ошибка, нельзя отправить запрос провайдеру"],
        [4, "Неверный формат счета/телефона"],
        [5, "Номер не принадлежит оператору"],
        [8, "Прием платежа запрещен по техническим причинам"],
        [131, "Платежи на выбранного провайдера запрещено проводить из данной страны."],
        [202, "Ошибка в параметрах запроса"],
        [220, "Недостаточно средств"],
        [241, "Сумма платежа меньше минимальной"],
        [242, "Сумма платежа больше максимальной"],
        [319, "Платеж невозможен"],
        [500, "По техническим причинам этот платеж не может быть выполнен. Для совершения платежа обратитесь, пожалуйста, в свой обслуживающий банк"],
        [522, "Неверный номер или срок действия карты получателя"],
        [547, "Ошибка в сроке действия карты получателя"],
        [548, "Истек срок действия карты получателя"],
        [561, "Платеж отвергнут оператором банка получателя"],
        [702, "Платеж не проведен из-за ограничений у получателя. Подробности по телефону: 8-800-707-77-59"],
        [705, "Ежемесячный лимит платежей и переводов для статуса Стандарт - 200 000 р. Для увеличения лимита пройдите идентификацию."],
        [746, "Превышен лимит по платежам в пользу провайдера"],
        [852, "Превышен лимит по платежам в пользу провайдера"],
        [893, "Срок действия перевода истек"],
        [1050, "Превышен лимит на операции, либо превышен дневной лимит на переводы на карты Visa/MasterCard"]
    ];
    console.log(allErrors[0][1]);
}

function fallBack(ctx) {
    Users.update({ "chatId": ctx.chat.id }, { $set: { "currentWallet": false } });
    ctx.reply("No wallets added."); //, Telegraf.Extra.markup((m) => m.removeKeyboard()));
}

function qiwiHistoryByToken(ctx, token) {
    console.log("GETTING LAST 5 OPERATIONS");
    var currenQiwinum = "empty";
    var Wallet = new Qiwi(token);

    Wallet.getOperationHistory({ rows: 10, operation: "IN" }, (err, operations) => {
        if (err) {
            console.log(err);
            ctx.replyWithMarkdown("Error occureed :(");
            return;
        }

        var resultData = "";
        operations.data.forEach((curr) => {
            if (curr.status == "SUCCESS") {
                resultData = ("✅ From: " + curr.personId +
                    " `+" + curr.sum.amount + currDec(curr.sum.currency) + "` \n" +
                    "Comment: `n" + curr.comment + "`" +
                    " id: `" + curr.txnId + "`\n" +
                    "`" + curr.date.replace("Date:", "").replace("+03:00", "").replace("T", " ") + "` \n\n") + resultData;
            }
        });
        if (resultData.length > 5) {
            ctx.replyWithMarkdown(resultData);
        } else {
            ctx.replyWithMarkdown("There are no operations yet :)");
        }
        /* some code */
    });
}

function qiwiBalanceByToken(ctx, token) {
    var currenQiwinum = "empty";
    var Wallet = new Qiwi(token);
    Wallet.getAccountInfo((err, info) => {
        if (err) {
            console.log(err);
            ctx.replyWithMarkdown("Error occureed :(");
            return;
        }
        console.log("Qiwi account:", info.authInfo.personId);
        currenQiwinum = info.authInfo.personId;
        // ctx.replyWithMarkdown('Alright! Getting balances for: `+' + info.authInfo.personId + '`').then(() => {
        Wallet.getBalance((err, balance) => {
            if (err) {
                /*hanle error*/
                console.log(err);
            } else {
                //var totalBalance = 0;
                var finalAnswerMessage = "Your current balances for: `+" + currenQiwinum + "`";
                for (var i = balance.accounts.length - 1; i >= 0; i--) {
                    var resultBalance = 0;
                    if (balance.accounts[i].balance) {
                        resultBalance = balance.accounts[i].balance.amount;
                    }

                    if (balance.accounts[i].alias == "qw_wallet_rub") {
                        finalAnswerMessage += ("\n `" + resultBalance + "` RUB");
                    } else if (balance.accounts[i].alias == "qw_wallet_usd") {
                        finalAnswerMessage += ("\n `" + resultBalance + "` USD");
                    } else if (balance.accounts[i].alias == "qw_wallet_eur") {
                        finalAnswerMessage += ("\n `" + resultBalance + "` EUR");
                    } else if (balance.accounts[i].alias == "qw_wallet_kzt") {
                        finalAnswerMessage += ("\n `" + resultBalance + "` KZT");
                    }
                    console.log("the " + balance.accounts[i].alias + " balance is: " + resultBalance);
                    //totalBalance += parseFloat(resultBalance);
                }
                ctx.replyWithMarkdown(finalAnswerMessage);
            }
        });
        // });
    });
}

function currDec(curr) {
    if (curr == "643") {
        return "₽";
    } else if (curr == "840") {
        return "$";
    } else if (curr == "978") {
        return "eur.";
    } else {
        return "lol.";
    }
}

function checkIfUserHaveWallets(ctx) {
    var AnyWallets = QiwiWallets.findOne({ "owner": ctx.chat.id });
    console.log(AnyWallets);
    if (AnyWallets != undefined) {
        console.log("Wallets found!");
        return QiwiWallets.find({ "owner": ctx.chat.id });
    } else {
        console.log("no wallets found!");
        return false;
    }
}

function checkOrSaveUser(ctx) {
    var ifUserBefore = Users.findOne({ "chatId": ctx.chat.id });

    if (ifUserBefore == undefined) {
        console.log("YO! New user, let's save him!");
        Users.insert({ "chatId": ctx.chat.id, "Date": Date.now(), "Data": ctx.chat, "shortId": Random.id(4) });
        ifUserBefore = Users.findOne({ "chatId": ctx.chat.id });
        var result = [false, ifUserBefore];
        return result;
    } else {
        console.log("Meh, user already exists C:");
        var result = [true, ifUserBefore];
        return result;
    }
}

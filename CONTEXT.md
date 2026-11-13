# MC Budget

Personal budgeting with wallets that split money into fixed category percentages. Transactions can come from bank alerts that the user forwards to the app.

## Bank alerts

**Alert**:
One bank notification (email or SMS text) about one transaction, as the user sent it to the app.
_Avoid_: Notification, bank email, message

**Channel**:
The way an Alert reached the app: auto-forward, manual forward, paste or share.
_Avoid_: Source, method

**Forward address**:
A user's private email address at the app's inbound domain. Mail sent to it arrives as Alerts for that user.
_Avoid_: Inbox address, alias, mailbox

**Pending alert**:
An Alert that was parsed into a proposed transaction and waits for the user to confirm or discard it. Every Alert starts as Pending.
_Avoid_: Draft, unconfirmed transaction

**Parser template**:
Data that tells the engine how to read Alerts from one bank: which senders it applies to and where each field is in the text.
_Avoid_: Parser, rule, bank format

**Account link**:
The user's mapping from a bank account or card (by the last digits in an Alert) to one of their wallets.
_Avoid_: Card mapping, account mapping

**Merchant rule**:
The user's mapping from a merchant name in an Alert to a budget category.
_Avoid_: Category rule, auto-categorisation

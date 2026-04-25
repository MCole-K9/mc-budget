# Changelog

## [1.3.0](https://github.com/MCole-K9/mc-budget/compare/v1.2.0...v1.3.0) (2026-04-25)


### Features

* enhance transaction handling by updating total_funded during transfers and recalculations ([c6949d2](https://github.com/MCole-K9/mc-budget/commit/c6949d2e17a62be03d0140485c0283970baa28a5))

## [1.2.0](https://github.com/MCole-K9/mc-budget/compare/v1.1.0...v1.2.0) (2026-03-26)


### Features

* refactor date handling by introducing utility functions for date formatting and retrieval ([8cb0df9](https://github.com/MCole-K9/mc-budget/commit/8cb0df9b2390487d4ea061811b25ac1189a2e040))

## [1.1.0](https://github.com/MCole-K9/mc-budget/compare/v1.0.1...v1.1.0) (2026-03-25)


### Features

* add archived state to wallets with functionality to archive and unarchive wallets ([73e5652](https://github.com/MCole-K9/mc-budget/commit/73e565254242e2567d044ef8e411b6b4b5e360db))
* add edit transaction functionality with form and update logic ([9d41c51](https://github.com/MCole-K9/mc-budget/commit/9d41c513d19abf64466fef26c5eba9de3f0fe7b3))
* add updateCategoryColor functionality to modify category colors in wallets ([250b226](https://github.com/MCole-K9/mc-budget/commit/250b226f0ca5c84d888bbdb1556c3f12c5d33c20))
* Edit transaction + Transfer Funds + Archive Wallet and Friends ([d5ac0ce](https://github.com/MCole-K9/mc-budget/commit/d5ac0ce89766cf9b8cce91560dd3638601e41f6f))
* enhance delete wallet confirmation with input validation ([ed8d1d3](https://github.com/MCole-K9/mc-budget/commit/ed8d1d337acb249f34045c058aaf8a812a3f74cb))
* implement computeTransferDeleteDeltas function and update transaction deletion logic for accurate balance adjustments ([811230f](https://github.com/MCole-K9/mc-budget/commit/811230f8c2dee839416624316a05feff1ac15259))
* implement date range utility and refactor date handling in forms and reports ([ab2e7c3](https://github.com/MCole-K9/mc-budget/commit/ab2e7c3e664658405b5aa6f40acff232af2c75a6))
* implement transfer functionality between wallets with validation and UI integration ([ce2bf29](https://github.com/MCole-K9/mc-budget/commit/ce2bf292cca2f1439a06daf21c95ee0ff40c068d))
* prevent editing of transactions with transfer_id in TransactionList component ([3a64383](https://github.com/MCole-K9/mc-budget/commit/3a643833ff147da9a4700a67dd4b357b3c51be35))
* refactor delete wallet button into dropdown menu for improved UI ([3403c27](https://github.com/MCole-K9/mc-budget/commit/3403c2762696168392706aebb4cd2f01bed9620f))
* update wallet retrieval to include requestKey for consistency in create and update operations ([18e2774](https://github.com/MCole-K9/mc-budget/commit/18e27745a5d7a957c62c9744e84cc378360bf2a3))

## [1.0.1](https://github.com/MCole-K9/mc-budget/compare/v1.0.0...v1.0.1) (2026-03-18)


### Bug Fixes

* file upload size limit ([#4](https://github.com/MCole-K9/mc-budget/issues/4)) ([e422996](https://github.com/MCole-K9/mc-budget/commit/e4229968b3e2f909f6261ddfda029f5aaa87fa91))
* secure password handling by renaming fields in authentication schemas and forms ([#6](https://github.com/MCole-K9/mc-budget/issues/6)) ([2730350](https://github.com/MCole-K9/mc-budget/commit/273035094502c9228b794a9ffe2c5bbfdd722613))

## 1.0.0 (2026-03-15)


### Features

* add autodate fields to presets, wallets, and transactions collections ([d8b9d90](https://github.com/MCole-K9/mc-budget/commit/d8b9d90e479c6fb441766db9132d0346c0f0a033))
* add category spending calculation and update budget allocation display ([552885b](https://github.com/MCole-K9/mc-budget/commit/552885b7787f6c0efec9e69b9bdca412fa59bff8))
* add configuration files for PocketBase and SvelteKit services ([57d52c1](https://github.com/MCole-K9/mc-budget/commit/57d52c1e8b5dc43e82c30c08784ed87229a1b737))
* add cycle offset functionality for pay cycle date range adjustment ([057c55b](https://github.com/MCole-K9/mc-budget/commit/057c55ba9bd75215a391e775f424d052e37117ca))
* add Docker support with PocketBase and SvelteKit ([d57b7d7](https://github.com/MCole-K9/mc-budget/commit/d57b7d73e39928b760b4a635a92d8139a0b2131d))
* add functionality to jump to pay cycle based on selected date ([3a9b0c8](https://github.com/MCole-K9/mc-budget/commit/3a9b0c872b55d6c568fbfe65aa9872f58106e393))
* add initial_balance field to wallets and implement balance recalculation ([d0320f4](https://github.com/MCole-K9/mc-budget/commit/d0320f434facce936fe0eac0a996ed1c793d06c1))
* add migration to make wallet balance field optional ([873774d](https://github.com/MCole-K9/mc-budget/commit/873774dc8a3771f0076f0ff377600771bda5a9b5))
* add new migration files for collections, fields, and initial data setup ([7c10393](https://github.com/MCole-K9/mc-budget/commit/7c103936f41fc487645bf1b6ccbedfa0d73ffa8b))
* add pagination and month filtering for transactions in wallet view ([7feba5e](https://github.com/MCole-K9/mc-budget/commit/7feba5e4617c50c75a02a270e16a743b99cac36c))
* add receipt upload functionality to transactions and update related components ([c26993a](https://github.com/MCole-K9/mc-budget/commit/c26993ac40801d3113b0ce01fd50779cfa9c9024))
* add recurring transaction functionality with UI support and migration ([413ad80](https://github.com/MCole-K9/mc-budget/commit/413ad80e806da98c52f492e4811625ffbd9b0f92))
* add release workflow and configuration files for automated releases ([bf88ed5](https://github.com/MCole-K9/mc-budget/commit/bf88ed5df29afe0e2d54290d5422bdfe38d246c6))
* add reports page with chart visualizations and filtering options ([1d07730](https://github.com/MCole-K9/mc-budget/commit/1d077302e4d62c388803acb567411ad0b2834c58))
* add requestKey null parameter to getTransactionsPaged query ([8ce53e4](https://github.com/MCole-K9/mc-budget/commit/8ce53e4a3573b914732be77a271b458774f1571e))
* add requestKey null parameter to getTransactionSummary query ([e0a1342](https://github.com/MCole-K9/mc-budget/commit/e0a13422bdb7f6c0e64c8d88975bd04f4a91dc2f))
* add saved period preferences and cycle start day configuration for wallets ([23e09cf](https://github.com/MCole-K9/mc-budget/commit/23e09cfcde9efbad640ddf492095df70ef183391))
* add seed data migration for demo account and transactions ([2f1be1f](https://github.com/MCole-K9/mc-budget/commit/2f1be1fe965773ee3bf49697b9ba57ebc7edb4a7))
* add total_funded field to wallets and update related transaction logic ([028781b](https://github.com/MCole-K9/mc-budget/commit/028781b2f2865503dd7c617f4dbc70e26635bbd5))
* add transaction summary functionality with server-side aggregation ([c100bb0](https://github.com/MCole-K9/mc-budget/commit/c100bb0e46c20e5a033bc200fe3915b694947ab1))
* add transactions page with pagination and date filtering ([3317b78](https://github.com/MCole-K9/mc-budget/commit/3317b7887816af93339a5edeb407587a32af23cb))
* add validation for fixed budget categories to require at least one category ([9fe3e6f](https://github.com/MCole-K9/mc-budget/commit/9fe3e6f25bb4b0a29c01f1061c363322a42da3f2))
* adjust date filtering to include end of day for transaction queries ([3478a41](https://github.com/MCole-K9/mc-budget/commit/3478a413f9ff91c82617a0fc17a78a5bc0f2ed43))
* consolidate migration files and enhance collection schemas with user relations and new fields ([e7d8145](https://github.com/MCole-K9/mc-budget/commit/e7d81458f6e5d128f835444b727684eec9fe8826))
* enhance budget handling by adding support for fixed budget type in BudgetPresetSelector and related components ([5edded7](https://github.com/MCole-K9/mc-budget/commit/5edded7ba19dee95250f773d98f96315e918a569))
* enhance error handling for login and registration processes ([8719686](https://github.com/MCole-K9/mc-budget/commit/87196869efd193ae9570d4ef08a7730a3dcfeed4))
* enhance PocketBase integration with migrations and presets management ([179a1fb](https://github.com/MCole-K9/mc-budget/commit/179a1fb6f672e85b7b7a59e81106af8bd00594bb))
* enhance receipt scanning functionality and improve schema validation ([ebcc19e](https://github.com/MCole-K9/mc-budget/commit/ebcc19e2a950f893ae1f5d75a95fa6dfea4edfce))
* enhance transaction form and handling with income source and improved deletion confirmation ([3725e43](https://github.com/MCole-K9/mc-budget/commit/3725e4375c4e3ba7ef9e365b2cb53bb4da5e00b3))
* enhance wallet and transaction handling with recent activity display and improved formatting ([89dee79](https://github.com/MCole-K9/mc-budget/commit/89dee7945b30ee80254c7ff27c289d5dc07d65cc))
* enhance wallet overview with budget status indicators and improve layout ([8845c7d](https://github.com/MCole-K9/mc-budget/commit/8845c7dc7c580d21b56756df3561aa2332e079ea))
* implement budget type selection with fixed and percentage options across wallet and category components ([9322ecf](https://github.com/MCole-K9/mc-budget/commit/9322ecf69c6959426064afc541bc6faa8c1160c4))
* implement budget validation and wallet management features ([f538462](https://github.com/MCole-K9/mc-budget/commit/f5384626e5d15599cc43972df7b1ed360c3fe58c))
* implement date range filtering for transactions in wallet view ([c6be23e](https://github.com/MCole-K9/mc-budget/commit/c6be23ec27f34f1edb046ab2b570ffd670a1ad0c))
* implement financial settings with base currency management and exchange rate fetching ([955788f](https://github.com/MCole-K9/mc-budget/commit/955788fbbadb5a94a050c01073f2bdc3fbaa3361))
* implement PocketBase integration for transactions and wallets ([89e254d](https://github.com/MCole-K9/mc-budget/commit/89e254df3bae7aaeaa78c7335d95c6cff1947318))
* implement token-based authentication with cookie management for login and registration ([c5a81eb](https://github.com/MCole-K9/mc-budget/commit/c5a81eb7e9569ae1c32576566cf8adcbcc9569ba))
* implement user settings management with personal API key support ([8ad34e3](https://github.com/MCole-K9/mc-budget/commit/8ad34e35c81919f48544c1efb31d855ad19a0320))
* implement user-specific budget presets with create and delete functionality ([47b836d](https://github.com/MCole-K9/mc-budget/commit/47b836d110263eb1cb0f361f72d6ec09dc6f31e2))
* integrate AI receipt scanning with multiple provider support and settings management ([27cbec3](https://github.com/MCole-K9/mc-budget/commit/27cbec3a3015d1b742cd8ca07c962ad2fdf0cd63))
* optimize each block usage by adding keys for better performance ([47f8f35](https://github.com/MCole-K9/mc-budget/commit/47f8f3567441a3142dfaea0663f19cdd7673baa6))
* optimize wallet and transaction data fetching using Promise.all ([725c981](https://github.com/MCole-K9/mc-budget/commit/725c981c52f4f685a4886a357a39135a537bb8be))
* refactor Auth and Theme stores to use class syntax for improved structure and readability ([9f00529](https://github.com/MCole-K9/mc-budget/commit/9f005291fc963ea7080986cee30f97564637f3b2))
* refactor authentication handling and improve user session management ([bcaeeb2](https://github.com/MCole-K9/mc-budget/commit/bcaeeb2f08755a61cdf6957f654fa51f8fce8fed))
* refactor routing to use resolve for path consistency and improve navigation ([71a47bb](https://github.com/MCole-K9/mc-budget/commit/71a47bb6b9138e4e728541ee5fe7a99ee3193ac4))
* refresh wallet data after create and delete operations, and optimize transaction retrieval with derived stores ([fccd14c](https://github.com/MCole-K9/mc-budget/commit/fccd14c7d39a20298f775939ea97320b092a70c2))
* remove obsolete migration files for wallet and app settings ([302d240](https://github.com/MCole-K9/mc-budget/commit/302d2408d2ab89d9aee336a0cc8632161aa172ce))
* remove unused API files and streamline theme toggle functionality ([b5064b7](https://github.com/MCole-K9/mc-budget/commit/b5064b7e7f85b06dcd4acc8d9019da4d78999a77))
* rename 'key' to 'skey' in app settings migration and update related functions ([e5ea293](https://github.com/MCole-K9/mc-budget/commit/e5ea293d18742d7e3216d7796fe0a2a8be8b7357))
* simplify user schema and improve error handling in authentication functions ([bf20a07](https://github.com/MCole-K9/mc-budget/commit/bf20a07662c7f684f0df2e3eab94a9eb501d9d66))
* update Alert component to use ClassValue type for class prop and improve class binding ([a6243db](https://github.com/MCole-K9/mc-budget/commit/a6243dbade992bb82c919f0f11f2e2ebcf0dd761))
* update async component usage with top-level await and improved loading/error handling ([d88b525](https://github.com/MCole-K9/mc-budget/commit/d88b525787a11991c760d3e07cdccbbdc7b98e12))
* update button styles for balance recalculation and improve icon representation ([420f1ab](https://github.com/MCole-K9/mc-budget/commit/420f1ab3713185433dc6e8930efb870cc28b878a))
* update components to use ClassValue type for class prop and improve class binding ([32b9dd4](https://github.com/MCole-K9/mc-budget/commit/32b9dd4f8034c259c505de42e8fca090b3fbf9af))
* update form components to use div for labels and enhance accessibility ([f3232b1](https://github.com/MCole-K9/mc-budget/commit/f3232b17524b21ebe4cbaea6f82ade807c95f2c7))
* update login and register components to use token-based authentication and save user data ([053217f](https://github.com/MCole-K9/mc-budget/commit/053217ff1e8fd653e7ec203c0d4b0760f3237414))
* update transaction handling to refresh data after create and delete operations ([97908ed](https://github.com/MCole-K9/mc-budget/commit/97908edfd31d97a422131f91691fb4fd943d60e5))
* update UI components for improved layout and styling consistency ([d65b4bc](https://github.com/MCole-K9/mc-budget/commit/d65b4bc99c2e261707f13fcc1fcb160b7ace2be5))


### Bug Fixes

* initialize lastResultId with createTransaction result ID ([b5eeb9e](https://github.com/MCole-K9/mc-budget/commit/b5eeb9e63b4531e0f678a85b79ad8e218843b116))

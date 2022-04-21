/*global location history */
sap.ui.define([
	"ZVNDSCR/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/ui/core/routing/History",
	"ZVNDSCR/model/formatter",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/ui/model/Sorter",
	"sap/ui/export/Spreadsheet",
	"sap/ui/export/library"
], function(BaseController, JSONModel, History, formatter, Filter, FilterOperator, Sorter, Spreadsheet, exportLibrary) {
	"use strict";

	return BaseController.extend("ZVNDSCR.controller.Worklist", {

		formatter: formatter,

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */

		/**
		 * Called when the worklist controller is instantiated.
		 * @public
		 */
		onInit: function() {
			var oViewModel,
				iOriginalBusyDelay,
				oTable = this.byId("table");

			// Put down worklist table's original value for busy indicator delay,
			// so it can be restored later on. Busy handling on the table is
			// taken care of by the table itself.
			iOriginalBusyDelay = oTable.getBusyIndicatorDelay();
			// keeps the search state
			this._aTableSearchState = [];

			// Model used to manipulate control states
			oViewModel = new JSONModel({
				worklistTableTitle: this.getResourceBundle().getText("worklistTableTitle"),
				saveAsTileTitle: this.getResourceBundle().getText("saveAsTileTitle", this.getResourceBundle().getText("worklistViewTitle")),
				shareOnJamTitle: this.getResourceBundle().getText("worklistTitle"),
				shareSendEmailSubject: this.getResourceBundle().getText("shareSendEmailWorklistSubject"),
				shareSendEmailMessage: this.getResourceBundle().getText("shareSendEmailWorklistMessage", [location.href]),
				tableNoDataText: this.getResourceBundle().getText("tableNoDataText"),
				tableBusyDelay: 0
			});
			this.setModel(oViewModel, "worklistView");

			// Make sure, busy indication is showing immediately so there is no
			// break after the busy indication for loading the view's meta data is
			// ended (see promise 'oWhenMetadataIsLoaded' in AppController)
			oTable.attachEventOnce("updateFinished", function() {
				// Restore original busy indicator delay for worklist's table
				oViewModel.setProperty("/tableBusyDelay", iOriginalBusyDelay);
			});
			// Add the worklist page to the flp routing history
			this.addHistoryEntry({
				title: this.getResourceBundle().getText("worklistViewTitle"),
				icon: "sap-icon://table-view",
				intent: "#VendorsScores-display"
			}, true);

			// Initially disabling company and vendor selectors

			this.getView().byId("companySelector").setEnabled(false);
			this.getView().byId("vendorSelector").setEnabled(false);
			this.getView().byId("scoreRangeSelector").setEnabled(false);

			// Setting initial jsons for dynamic comboboxes

			var companies = {
				DynamicCompaniesList: null
			};

			var oCompaniesModel = new JSONModel(companies);
			this.byId("companySelector").setModel(oCompaniesModel);

			var vendors = {
				DynamicVendorsList: null
			};

			var oVendorsModel = new JSONModel(vendors);
			this.byId("vendorSelector").setModel(oVendorsModel);

			// Listener on header click

			var t = this;
			oTable.addEventDelegate({
				onAfterRendering: function() {
					var oHeader = this.$().find(".sapMListTblHeaderCell"); //Get hold of table header elements

					for (var i = 0; i < oHeader.length; i++) {
						var oID = oHeader[i].id;
						t.onHeaderClick(oID);
					}
				}
			}, oTable);

			// Link to options fragment

			if (!this._oResponsivePopover) {
				this._oResponsivePopover = sap.ui.xmlfragment("ZVNDSCR.view.Options", this);
				this._oResponsivePopover.setModel(this.getView().getModel());
			}

			var oEventBus = sap.ui.getCore().getEventBus();
			// 1. ChannelName, 2. EventName, 3. Function to be executed, 4. Listener
			oEventBus.subscribe("ObjectAction", "onVendorDataChanged", this.onVendorDataChanged, this);

		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */

		/**
		 * Triggered by the table's 'updateFinished' event: after new table
		 * data is available, this handler method updates the table counter.
		 * This should only happen if the update was successful, which is
		 * why this handler is attached to 'updateFinished' and not to the
		 * table's list binding's 'dataReceived' method.
		 * @param {sap.ui.base.Event} oEvent the update finished event
		 * @public
		 */

		onVendorDataChanged: function(sChannel, sEvent) {

			this.onRefresh();

		},

		createColumnConfig: function() {
			var aCols = [];

			var EdmType = exportLibrary.EdmType;

			aCols.push({
				property: 'VendorCode',
				label: 'Código de Fornecedor',
				type: EdmType.String
			});

			aCols.push({
				property: 'VendorName',
				label: 'Nome do Fornecedor',
				type: EdmType.String
			});

			aCols.push({
				property: 'Score',
				type: EdmType.String
			});

			return aCols;
		},

		onExportToExcel: function(oEvent) {

			var aCols, oRowBinding, oSettings, oSheet, oTable;

			if (!this._oTable) {
				this._oTable = this.byId('table');
			}

			oTable = this._oTable;
			oRowBinding = oTable.getBinding('items');

			aCols = this.createColumnConfig();

			var oModel = oRowBinding.getModel();

			oSettings = {
				workbook: {
					columns: aCols,
					hierarchyLevel: 'Level'
				},
				dataSource: {
					type: 'odata',
					dataUrl: oRowBinding.getDownloadUrl ? oRowBinding.getDownloadUrl() : null,
					serviceUrl: this._sServiceUrl,
					headers: oModel.getHeaders ? oModel.getHeaders() : null,
					count: oRowBinding.getLength ? oRowBinding.getLength() : null,
					useBatch: true // Default for ODataModel V2
				},
				fileName: 'VendorsList.xlsx',
				worker: false // We need to disable worker because we are using a MockServer as OData Service
			};

			oSheet = new Spreadsheet(oSettings);
			oSheet.build().finally(function() {
				oSheet.destroy();
			});

		},

		onUpdateFinished: function(oEvent) {

			// update the worklist's object counter after the table update
			var sTitle,
				oTable = oEvent.getSource(),
				iTotalItems = oEvent.getParameter("total");
			// only update the counter if the length is final and
			// the table is not empty
			if (iTotalItems && oTable.getBinding("items").isLengthFinal()) {
				sTitle = this.getResourceBundle().getText("worklistTableTitleCount", [iTotalItems]);
			} else {
				sTitle = this.getResourceBundle().getText("worklistTableTitle");
			}
			this.getModel("worklistView").setProperty("/worklistTableTitle", sTitle);

			if (oTable.getBinding("items").getLength() > 0) {

				this.getView().byId("exportToExcel").setVisible(true);
			} else {

				this.getView().byId("exportToExcel").setVisible(false);
			}

		},

		/**
		 * Event handler when a table item gets pressed
		 * @param {sap.ui.base.Event} oEvent the table selectionChange event
		 * @public
		 */
		onPress: function(oEvent) {
			// The source is the list item that got pressed
			this._showObject(oEvent.getSource());
		},

		/**
		 * Event handler when the share in JAM button has been clicked
		 * @public
		 */
		onShareInJamPress: function() {
			var oViewModel = this.getModel("worklistView"),
				oShareDialog = sap.ui.getCore().createComponent({
					name: "sap.collaboration.components.fiori.sharing.dialog",
					settings: {
						object: {
							id: location.href,
							share: oViewModel.getProperty("/shareOnJamTitle")
						}
					}
				});
			oShareDialog.open();
		},

		onHeaderClick: function(oID) {

			var t = this,
				oTable = this.byId("table");

			$("#" + oID).click(function(oEvent) { //Attach Table Header Element Event
				var oTarget = oEvent.currentTarget; //Get hold of Header Element

				var oLabelText = oTarget.childNodes[0].textContent; //Get Column Header text

				if (oLabelText === t.getResourceBundle().getText("vendorScore")) {

					// Displaying pop-up for sorting if there are records in table

					if (oTable.getBinding("items").getLength() > 0) {

						t._oResponsivePopover.openBy(oTarget);

					} // if (oLabelText === t.getResourceBundle().getText("vendorScore")) 

				} // if (oLabelText === t.getResourceBundle().getText("vendorScore")) 

			});

		},
		onAscending: function() {
			var oRatingSorter = new Sorter({
				path: "Score",
				descending: false
			});
			var oTable = this.getView().byId("table");
			oTable.getBinding("items").sort(oRatingSorter);
			this._oResponsivePopover.close();
		},

		onDescending: function() {
			var oRatingSorter = new Sorter({
				path: "Score",
				descending: true
			});
			var oTable = this.getView().byId("table");
			oTable.getBinding("items").sort(oRatingSorter);
			this._oResponsivePopover.close();
		},
		setEmptyFilters: function() {
			var aTableSearchState = [];

			aTableSearchState.push(
				new Filter({
					path: "System",
					operator: sap.ui.model.FilterOperator.EQ,
					value1: ""
				}));

			aTableSearchState.push(
				new Filter({
					path: "CompanyCode",
					operator: sap.ui.model.FilterOperator.EQ,
					value1: ""
				}));

			aTableSearchState.push(
				new Filter({
					path: "VendorCode",
					operator: sap.ui.model.FilterOperator.Contains,
					value1: ""
				}));

			this._applySearch(aTableSearchState);
		},

		onSearch: function(oEvent) {

			// Taking Vendor search value

			var selectedVendor = this.getView().byId("vendorSelector").getSelectedKey();

			// Taking a value for the selected system and company

			var selectedSystem = this.getView().byId("systemSelector").getSelectedKey();

			// For company we pick value, as order of key/value changed for display purposes

			var selectedCompany = this.getView().byId("companySelector").getSelectedItem().getText();

			// Filter for score ranges

			if (this.getView().byId("scoreRangeSelector").getSelectedItem()) {

				var selectedScoreRange = this.getView().byId("scoreRangeSelector").getSelectedItem().getKey();

			} // if ( this.getView().byId("scoreRangeSelector").getSelectedItem() )

			var aTableSearchState = [];

			aTableSearchState.push(
				new Filter({
					path: "System",
					operator: sap.ui.model.FilterOperator.EQ,
					value1: selectedSystem
				}));

			aTableSearchState.push(
				new Filter({
					path: "CompanyCode",
					operator: sap.ui.model.FilterOperator.EQ,
					value1: selectedCompany
				}));

			if (selectedVendor) {

				aTableSearchState.push(
					new Filter({
						path: "VendorCode",
						operator: sap.ui.model.FilterOperator.Contains,
						value1: selectedVendor
					}));
			}

			if (selectedScoreRange) {

				aTableSearchState.push(
					new Filter({
						path: "Score",
						operator: sap.ui.model.FilterOperator.EQ,
						value1: selectedScoreRange
					}));
			}

			this._applySearch(aTableSearchState);

		},

		handleChangeSystem: function(oEvent) {

			var t = this;
			var updatedLabel;

			// Cleaning all records from table

			t.setEmptyFilters();

			// Disabling company and vendor selectors and cleaning the data

			t.getView().byId("companySelector").setEnabled(false);
			t.getView().byId("companySelector").setSelectedKey(null);
			var initialLabelCompany = t.getResourceBundle().getText("selectCompany");
			t.getView().byId("tableFilters2").setLabel(initialLabelCompany);

			t.getView().byId("mainFilterBar").setSearchEnabled(false);
			t.getView().byId("vendorSelector").setEnabled(false);
			t.getView().byId("vendorSelector").setSelectedKey(null);
			var initialLabelVendor = t.getResourceBundle().getText("selectVendor");
			t.getView().byId("tableFilters3").setLabel(initialLabelVendor);

			t.getView().byId("scoreRangeSelector").setEnabled(false);
			t.getView().byId("scoreRangeSelector").setSelectedKey(null);

			var oValidatedComboBox = oEvent.getSource(),
				sSelectedKey = oValidatedComboBox.getSelectedKey();

			var oDataPath = "/sap/opu/odata/sap/ZVENDORS_SCORES_SRV/";

			var oModel = new sap.ui.model.odata.ODataModel(oDataPath, true);
			var aFlt = [new sap.ui.model.Filter({
				path: "SystemID",
				operator: sap.ui.model.FilterOperator.EQ,
				value1: sSelectedKey
			})];

			var oCompaniesModel = new JSONModel();

			//read company codes from oData    

			oModel.read("/CompanySet", {
				filters: aFlt,
				async: false,
				success: function(oData, oResponse) {

					//Create JSON Model     

					var json = oData.results;
					var companies;

					companies = {
						DynamicCompaniesList: json
					};

					oCompaniesModel = new JSONModel(companies);

					// Enabling company selector

					if (json.length > 0) {

						var toastMessage = t.getResourceBundle().getText("companiesListLoaded", json.length);
						sap.m.MessageToast.show(toastMessage);

						t.getView().byId("companySelector").setEnabled(true);

						initialLabelCompany = t.getResourceBundle().getText("selectCompany");
						updatedLabel = initialLabelCompany + '(' + json.length + ')';
						t.getView().byId("tableFilters2").setLabel(updatedLabel);
					} else

					{

						toastMessage = t.getResourceBundle().getText("noCompaniesLoaded");
						sap.m.MessageToast.show(toastMessage);

						updatedLabel = initialLabelCompany + '(0)';
						t.getView().byId("tableFilters2").setLabel(updatedLabel);
					}
				},
				error: function(oError) {
					//handle error     
				}
			});

			this.byId("companySelector").setModel(oCompaniesModel);

			// Selecting first company 

			// var firstCompany = this.getView().byId("companySelector").getFirstItem();
			// if (firstCompany) {
			// 	this.getView().byId("companySelector").setSelectedItem(firstCompany);
			// 	this.handleChangeCompany(oEvent);
			// }
		},

		handleChangeCompany: function(oEvent) {

			//this.getModel("appView").setProperty("/busy", true);

			//this.getModel("worklistView").setProperty("/busy", true);

			var t = this;

			t.setEmptyFilters();

			var initialLabel = t.getResourceBundle().getText("selectVendor");
			var updatedLabel = initialLabel + "(0)";

			// Updating selectors

			t.getView().byId("mainFilterBar").setSearchEnabled(false);

			t.getView().byId("tableFilters3").setLabel(updatedLabel);

			this.getView().byId("vendorSelector").setEnabled(false);
			this.getView().byId("vendorSelector").setSelectedKey(null);

			this.getView().byId("scoreRangeSelector").setEnabled(false);
			this.getView().byId("scoreRangeSelector").setSelectedKey(null);

			// // Taking selected System

			var selectedSystem = this.getView().byId("systemSelector").getSelectedKey();

			var oValidatedComboBox = oEvent.getSource(),
				sSelectedKey = oValidatedComboBox.getSelectedItem().getText();

			var oDataPath = "/sap/opu/odata/sap/ZVENDORS_SCORES_SRV/";

			var oModel = new sap.ui.model.odata.ODataModel(oDataPath, true);

			// oModel.attachRequestSent(function(){busyDialog.open();});
			// oModel.attachRequestCompleted(function(){busyDialog.close();});

			var aFlt = [];

			aFlt.push(new sap.ui.model.Filter({
				path: "CompanyCode",
				operator: sap.ui.model.FilterOperator.EQ,
				value1: sSelectedKey
			}));

			aFlt.push(new sap.ui.model.Filter({
				path: "System",
				operator: sap.ui.model.FilterOperator.EQ,
				value1: selectedSystem
			}));

			var oVendorsModel = new JSONModel();

			//read vendor codes from oData    

			oModel.read("/VendorSet", {
				filters: aFlt,
				async: false,
				success: function(oData, oResponse) {

					// oModel.attachRequestCompleted(function() {
					//     oBusy.close();
					//   });

					//Create JSON Model     

					var json = oData.results;
					var vendors;

					vendors = {
						DynamicVendorsList: json
					};

					oVendorsModel = new JSONModel(vendors);
					oVendorsModel.setSizeLimit(6000);

					// Enabling vendor selector 

					initialLabel = t.getResourceBundle().getText("selectVendor");

					if (json.length > 0) {

						var toastMessage = t.getResourceBundle().getText("vendorsListLoaded", json.length);
						sap.m.MessageToast.show(toastMessage);

						// Enabling filterbar button

						t.getView().byId("mainFilterBar").setSearchEnabled(true);

						t.getView().byId("vendorSelector").setEnabled(true);

						updatedLabel = initialLabel + '(' + json.length + ')';
						t.getView().byId("tableFilters3").setLabel(updatedLabel);

						t.getView().byId("scoreRangeSelector").setEnabled(true);

						t.getView().byId("exportToExcel").setVisible(true);

					} else {

						toastMessage = t.getResourceBundle().getText("noVendorsLoaded");
						sap.m.MessageToast.show(toastMessage);

						updatedLabel = initialLabel + '(0)';
						t.getView().byId("tableFilters3").setLabel(updatedLabel);

					}

				},
				error: function(oError) {
					//handle error     

				}
			});

			this.byId("vendorSelector").setModel(oVendorsModel);

		},

		/**
		 * Event handler for refresh event. Keeps filter, sort
		 * and group settings and refreshes the list binding.
		 * @public
		 */
		onRefresh: function() {

			var oTable = this.byId("table");
			oTable.getBinding("items").refresh();
		},

		/* =========================================================== */
		/* internal methods                                            */
		/* =========================================================== */

		/**
		 * Shows the selected item on the object page
		 * On phones a additional history entry is created
		 * @param {sap.m.ObjectListItem} oItem selected Item
		 * @private
		 */
		_showObject: function(oItem) {

			var t = this;

			var _vendorCode = oItem.getBindingContext().getProperty("VendorCode");

			var _system = this.getView().byId("systemSelector").getSelectedKey();

			// For company we pick value, as order of key/value changed for display purposes

			var _company = this.getView().byId("companySelector").getSelectedItem().getText();

			// Checking if vendor save is not pending

			if (oItem.getBindingContext().getProperty("PendingScoreSave") === 'X') {

				var d = this.getResourceBundle().getText("vendorPendingProcessExist");
				var z = this.getResourceBundle().getText("warning");

				//	sap.m.MessageBox.warning(d);

				sap.m.MessageBox.confirm(d, {
					title: z,
					actions: [
						sap.m.MessageBox.Action.OK,
						sap.m.MessageBox.Action.CANCEL
					],
					onClose: function(s) {

						if (s === sap.m.MessageBox.Action.OK) {

							t.getRouter().navTo("object", {
								VendorCode: _vendorCode,
								System: _system,
								CompanyCode: _company
							});

						}

					}
				});

			} else

			{
				this.getRouter().navTo("object", {
					VendorCode: _vendorCode,
					System: _system,
					CompanyCode: _company
				});
			} // if (oItem.getBindingContext().getProperty("PendingScoreSave") === 'X')

		},

		/**
		 * Internal helper method to apply both filter and search state together on the list binding
		 * @param {sap.ui.model.Filter[]} aTableSearchState An array of filters for the search
		 * @private
		 */
		_applySearch: function(aTableSearchState) {
			var oTable = this.byId("table"),
				oViewModel = this.getModel("worklistView");
			oTable.getBinding("items").filter(aTableSearchState, "Application");
			// changes the noDataText of the list in case there are no filter results
			if (aTableSearchState.length !== 0) {
				oViewModel.setProperty("/tableNoDataText", this.getResourceBundle().getText("worklistNoDataWithSearchText"));
			}

		}

	});
});
/*global location*/
sap.ui.define([
	"ZVNDSCR/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/ui/core/routing/History",
	"ZVNDSCR/model/formatter"
], function(
	BaseController,
	JSONModel,
	History,
	formatter
) {
	"use strict";

	return BaseController.extend("ZVNDSCR.controller.Object", {

		formatter: formatter,

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */

		/**
		 * Called when the worklist controller is instantiated.
		 * @public
		 */
		onInit: function() {
			// Model used to manipulate control states. The chosen values make sure,
			// detail page is busy indication immediately so there is no break in
			// between the busy indication for loading the view's meta data
			var iOriginalBusyDelay,
				oViewModel = new JSONModel({
					busy: true,
					delay: 0
				});

			this.getRouter().getRoute("object").attachPatternMatched(this._onObjectMatched, this);

			// Store original busy indicator delay, so it can be restored later on
			iOriginalBusyDelay = this.getView().getBusyIndicatorDelay();
			this.setModel(oViewModel, "objectView");
			this.getOwnerComponent().getModel().metadataLoaded().then(function() {
				// Restore original busy indicator delay for the object view
				oViewModel.setProperty("/delay", iOriginalBusyDelay);
			});

			this.filesValuesMatrix = [];

			this.filesSumsMatrix = [];

			this.filesActiveSwitchesMatrix = [];

			// Filling an array with score ranks descriptions

			this.scoreRankArray = [];

			this.fillScoreRankArray();

		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */

		/**
		 * Event handler when the share in JAM button has been clicked
		 * @public
		 */
		onShareInJamPress: function() {
			var oViewModel = this.getModel("objectView"),
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

		/* =========================================================== */
		/* internal methods                                            */
		/* =========================================================== */

		/**
		 * Binds the view to the object path.
		 * @function
		 * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
		 * @private
		 */
		_onObjectMatched: function(oEvent) {
			// var sObjectId =  oEvent.getParameter("arguments").objectId;

			var _vendorCode = oEvent.getParameter("arguments").VendorCode;
			var _system = oEvent.getParameter("arguments").System;
			var _company = oEvent.getParameter("arguments").CompanyCode;

			this.getModel().metadataLoaded().then(function() {
				var sObjectPath = this.getModel().createKey("VendorSet", {
					VendorCode: _vendorCode,
					System: _system,
					CompanyCode: _company
				});

				this._bindView("/" + sObjectPath);
			}.bind(this));
		},

		/**
		 * Binds the view to the object path.
		 * @function
		 * @param {string} sObjectPath path to the object to be bound
		 * @private
		 */
		_bindView: function(sObjectPath) {
			var oViewModel = this.getModel("objectView"),
				oDataModel = this.getModel();

			this.getView().bindElement({
				path: sObjectPath,
				events: {
					change: this._onBindingChange.bind(this),
					dataRequested: function() {
						oDataModel.metadataLoaded().then(function() {
							// Busy indicator on view should only be set if metadata is loaded,
							// otherwise there may be two busy indications next to each other on the
							// screen. This happens because route matched handler already calls '_bindView'
							// while metadata is loaded.
							oViewModel.setProperty("/busy", true);
						});
					},
					dataReceived: function() {
						oViewModel.setProperty("/busy", false);
					}
				}

			});

			// Cleaning all user changes in file validator
			// this.filesValuesMatrix = [];
			// this.setScoresToInitialValues();
			// this.getView().byId('activateWeightChange').setProperty("pressed", false);

			// this.getView().byId("calculatedScore")

			var oView = this.getView();
			var filesValidatorTable = oView.byId("FilesValidator");
			var filesValidatorTableItems = filesValidatorTable.getItems();

			for (var i = 0; i < filesValidatorTableItems.length; i++) {

				var filesValidatorTableItem = filesValidatorTableItems[i];
				filesValidatorTableItem.getCells()[4].setProperty('state', false);
				filesValidatorTableItem.getCells()[3].setEnabled(false);

			} // for (var i = 0; i < filesValidatorTableItems.length; i++)

		},

		fillScoreRankArray: function() {

			var t = this;

			var oDataPath = "/sap/opu/odata/sap/ZVENDORS_SCORES_SRV/";
			var oModel = new sap.ui.model.odata.ODataModel(oDataPath, true);

			// getting scores ranks from model

			oModel.read("/ScoreRanksSet", {

				async: false,
				success: function(oData, oResponse) {

					//Create JSON Model     

					var scoreRanksSet = oData.results;

					for (var i = 0; i < scoreRanksSet.length; i++) {

						t.scoreRankArray.push({
							"RankName": scoreRanksSet[i].RankName,
							"ScoreValue": parseFloat(scoreRanksSet[i].ScoreValue, 10)
						});

					} // for (var i = 0; i < scoreRanksSet.length; i++) 

				},
				error: function(oError) {
					//handle error     
				}
			});

		},

		onActivateWeightChangeChange: function(oEvent) {

			var oView = this.getView();
			var switchBtn = oEvent.getSource();
			//		var state = switchBtn.getState();

			var state = switchBtn.getProperty("pressed");

			var filesValidatorTable = oView.byId("FilesValidator");
			var filesValidatorTableItems = filesValidatorTable.getItems();

			for (var i = 0; i < filesValidatorTableItems.length; i++) {

				var filesValidatorTableItem = filesValidatorTableItems[i];

				filesValidatorTableItem.getCells()[3].setEnabled(state);

			} // for (var i = 0; i < filesValidatorTableItems.length; i++) 

		},
		setScoresToInitialValues: function() {

			this.filesValuesMatrix = [];

			this.getView().getModel().updateBindings(true);

			// Recalculating score

			this._onCalculateScore();

		},
		roundFloat: function(num, decimalPlaces) {
			var p = Math.pow(10, decimalPlaces);
			var m = Number((Math.abs(num) * p).toPrecision(15));
			return Math.round(m) / p * Math.sign(num);
		},

		onSubmitNewWeight: function(oEvent) {

			var oView = this.getView();
			//	var amountOfChecked = 0;
			var t = this;
			// this.filesValuesMatrix = [];
			var d;

			// Avoiding text symbols input: only numbers + comma/dot

			var _oInput = oEvent.getSource();

			var val = _oInput.getValue();

			// Splitting the difference

			if (val !== '') {

				var filesValidatorTable = oView.byId("FilesValidator");
				var filesValidatorTableItems = filesValidatorTable.getItems();

				var documentClass = oEvent.getSource().getBindingContext().getProperty("DocumentType");
				var totalDocumentsInClass = oEvent.getSource().getBindingContext().getProperty("TotalDocumentsInClass");

				// Calculate amount of checked documents for classes

				t.filesActiveSwitchesMatrix = [];

				for (var i = 0; i < filesValidatorTableItems.length; i++) {

					var filesValidatorTableItem = filesValidatorTableItems[i];
					var state = filesValidatorTableItem.getCells()[4].getProperty('state');

					// filling matrix of sums (doctype is an index-1)

					if (typeof t.filesSumsMatrix[filesValidatorTableItem.getBindingContext().getProperty("DocumentType") - 1] === 'undefined') {
						t.filesSumsMatrix.push(parseFloat(0, 10));
					} else {
						t.filesSumsMatrix[filesValidatorTableItem.getBindingContext().getProperty("DocumentType") - 1] = parseFloat(0, 10);
					}

					//	t.filesSumsMatrix[filesValidatorTableItem.getBindingContext().getProperty("DocumentType") - 1] = 0;

					if (typeof t.filesActiveSwitchesMatrix[filesValidatorTableItem.getBindingContext().getProperty("DocumentType") - 1] ===
						'undefined') {

						t.filesActiveSwitchesMatrix[filesValidatorTableItem.getBindingContext().getProperty("DocumentType") - 1] = parseInt(0, 10);

					}

					if (state === true) {

						t.filesActiveSwitchesMatrix[filesValidatorTableItem.getBindingContext().getProperty("DocumentType") - 1] =
							t.filesActiveSwitchesMatrix[filesValidatorTableItem.getBindingContext().getProperty("DocumentType") - 1] + parseInt(1, 10);

						//		amountOfChecked = amountOfChecked + 1;
					}
				}

				//  We're exluding all checked document for class and the document for which we're changing value

				var classActiveSwitches = parseInt(0, 10);

				if (t.filesActiveSwitchesMatrix[documentClass - 1] !== 'undefined') {

					classActiveSwitches = t.filesActiveSwitchesMatrix[documentClass - 1];
				}

				totalDocumentsInClass = parseInt(totalDocumentsInClass, 10) - classActiveSwitches - parseInt(1, 10);

				var documentNumber = oEvent.getSource().getBindingContext().getProperty("DocumentNumber");
				var initialDocumentWeight = oEvent.getSource().getBindingContext().getProperty("DocumentWeight");

				for (var j = 0; j < t.filesValuesMatrix.length; j++) {

					if ((t.filesValuesMatrix[j].DocumentNumber === documentNumber) && (parseFloat(t.filesValuesMatrix[j].Value, 10) > 0))

					{
						initialDocumentWeight = parseFloat(t.filesValuesMatrix[j].Value, 10);
					}

				}

				var deltaWeight = (Math.abs(this.roundFloat(initialDocumentWeight, 2) - parseFloat(this.roundFloat(val, 2), 10))) /
					totalDocumentsInClass;

				deltaWeight = this.roundFloat(deltaWeight, 2);

				t.filesValuesMatrix = [];

				for (i = 0; i < filesValidatorTableItems.length; i++) {

					filesValidatorTableItem = filesValidatorTableItems[i];

					var newWeight = parseFloat(filesValidatorTableItem.getCells()[3].getValue(), 10);

					// Changing value only for documents of a same class excluding all checked documents and document, on which we are located itself
					if ((documentClass === filesValidatorTableItem.getBindingContext().getProperty("DocumentType")))

					{

						if ((documentNumber !== filesValidatorTableItem.getBindingContext().getProperty("DocumentNumber")) &&
							(filesValidatorTableItem.getCells()[4].getProperty('state')) === false) {

							if (parseFloat(val, 10) >= parseFloat(initialDocumentWeight, 10)) {

								newWeight = parseFloat(filesValidatorTableItem.getCells()[3].getValue(), 10) - parseFloat(deltaWeight, 10);

							} else {

								newWeight = parseFloat(filesValidatorTableItem.getCells()[3].getValue(), 10) + parseFloat(deltaWeight, 10);

							} // 	if (parseFloat(val, 10) > parseFloat(initialDocumentWeight, 10)) 

							newWeight = parseFloat(newWeight, 10);
							newWeight = this.roundFloat(newWeight, 2);

							if (newWeight < parseInt(0, 10)) {
								newWeight = parseFloat(0, 10);
							}

							filesValidatorTableItem.getCells()[3].setValue(newWeight);

						} // if ((documentNumber !== filesValidatorTableItem.getBindingContext().getProperty("DocumentNumber"))...

						t.filesSumsMatrix[documentClass - 1] = t.filesSumsMatrix[documentClass - 1] + newWeight;

						if (parseInt(t.filesSumsMatrix[documentClass - 1], 10) > 100) {

							d = t.getResourceBundle().getText("enteredValueInvalid", t.filesSumsMatrix[documentClass - 1]);

							sap.m.MessageBox.error(d);

							t.filesValuesMatrix = [];

							this.setScoresToInitialValues();

							break;
						} // if (sum > 100)

					} // if ((documentClass === filesValidatorTableItem.getBindingContext().getProperty("DocumentType"))

					t.filesValuesMatrix.push({
						"DocumentNumber": filesValidatorTableItem.getBindingContext().getProperty("DocumentNumber"),
						"Value": newWeight
					});

				} // for (var i = 0; i < filesValidatorTableItems.length; i++)

				t._onCalculateScore();

			} // if ( val !== '' )

		},

		handleWeightChange: function(oEvent) {

			var t = this;

			// Avoiding text symbols input: only numbers + comma/dot

			var _oInput = oEvent.getSource();

			var val = _oInput.getValue();
			val = val.replace(/[^\d,.]/g, "");

			// Validating if value > 100 is entered

			if (parseFloat(val, 10) > 100.00) {

				var d = t.getResourceBundle().getText("enteredValueInvalidMore100");

				sap.m.MessageBox.error(d);

				this.setScoresToInitialValues();
				return;

			} else {
				_oInput.setValue(val);
			} //if (parseFloat(val, 10) > 100.00)

		},

		_onAttachmentSwitchChange: function() {

			this._onCalculateScore();
		},

		_onCalculateScore: function() {

			var t = this;
			var oView = this.getView();
			var switchState,
				documentWeight,
				classWeight,
				vendorScore = 0;

			var filesValidatorTable = oView.byId("FilesValidator");
			var filesValidatorTableItems = filesValidatorTable.getItems();

			for (var i = 0; i < filesValidatorTableItems.length; i++) {

				var filesValidatorTableItem = filesValidatorTableItems[i];

				switchState = filesValidatorTableItem.getCells()[4].getProperty('state');

				if (switchState === true) {

					documentWeight = filesValidatorTableItem.getCells()[3].getValue();
					classWeight = filesValidatorTableItem.getBindingContext().getProperty('ClassWeight');
					vendorScore = vendorScore + ((documentWeight * classWeight) / 100);

				} // if (switchState === true)

			} // for (var i = 0; i < filesValidatorTableItems.length; i++) 

			if (vendorScore > 100) {
				vendorScore = 100.00;
			}

			var finalScore = this.roundFloat(parseFloat(vendorScore, 10), 2);

			// this.getView().byId("calculatedScore").setText(finalScore + " %");

			// Searching for score text value

			for (var k = 0; k < t.scoreRankArray.length; k++) {

				var scoreRankValue = t.scoreRankArray[k].ScoreValue;

				if (finalScore >= scoreRankValue) {

					var scoreWithText = finalScore + '% ' + t.scoreRankArray[k].RankName;
					t.getView().byId("calculatedScore").setText(scoreWithText);

					break;
				}

			} // for (var k = 0; k < scoreRankArray.length; k++)

		},

		getCalculatedScore: function() {

			var score = this.getView().byId("calculatedScore").getText();

			// Removing % sign and spaces
			var scoreDigits = score.substring(0, score.indexOf('%'));

			scoreDigits = scoreDigits.replace(/\s/g, '');

			return scoreDigits;

		},

		onSaveScoreAndAttachments: function(oEvent) {

			var t = this,
				U = oEvent.getSource(),
				b = U.getText(),
				oView = this.getView(),
				oElementBinding = oView.getElementBinding(),
				sPath = oElementBinding.getPath(),
				oObject = oView.getModel().getObject(sPath),
				vendorCode = oObject.VendorCode;

			var scoreDigits = this.getCalculatedScore();

			if (scoreDigits === "0") {

				var d = t.getResourceBundle().getText("notAllowedToSaveWithZeroScore");

				sap.m.MessageBox.error(d);

			} else {

				var m = this.getResourceBundle().getText("confirmVendorSave", vendorCode);

				sap.m.MessageBox.confirm(m, {
					title: b,
					actions: [
						b,
						sap.m.MessageBox.Action.CANCEL
					],
					onClose: function(s) {

						if (s === b) {

							// Showing comment dialog

							t.commentText = '';

							t.commentDialog = sap.ui.xmlfragment("ZVNDSCR.view.CommentDialog", t);

							t.getView().addDependent(t.commentDialog);

							t.commentDialog.open();

						}

					}
				});
			} // if (scoreDigits === "0")
		},

		saveWithComment: function(oEvent) {

			var t = this,
				oView = this.getView(),
				oElementBinding = oView.getElementBinding(),
				sPath = oElementBinding.getPath(),
				oObject = oView.getModel().getObject(sPath),
				vendorCode = oObject.VendorCode,
				system = oObject.System,
				companyCode = oObject.CompanyCode,
				vendorName = oObject.VendorName,
				companyName = oObject.CompanyName,
				scoreText = oObject.ScoreText;

			var commentText = this.commentDialog.getContent()[0].getItems()[0].getContent()[0].getValue();

			this.commentDialog.destroy(true);

			// Saving vendor with score
			// var score = t.getView().byId("calculatedScore").getText();

			// // Removing % sign and spaces
			// var scoreDigits = score.substring(0, score.indexOf('%'));

			// scoreDigits = scoreDigits.replace(/\s/g, '');

			var scoreDigits = this.getCalculatedScore();

			t.saveVendor(system, companyCode, vendorCode, scoreDigits, commentText, vendorName, companyName, scoreText);

		},

		closeCommentDialog: function(oEvent) {
			this.commentDialog.destroy(true);
		},

		uploadPendingAttachments: function(delayMode) {

			var readIdPointer = "/AttachmentsSet?delayedMode=" + delayMode;

			var oUploadCollection = this.getView().byId('attachmentCollection');

			for (var z = 0; z < oUploadCollection._aFileUploadersForPendingUpload.length; z++) {

				var sUploadUrl = this.getModel().sServiceUrl + readIdPointer;
				oUploadCollection._aFileUploadersForPendingUpload[z].setUploadUrl(sUploadUrl);
				oUploadCollection._aFileUploadersForPendingUpload[z].upload();

			}
		},

		saveVendor: function(system, companyCode, vendorCode, score, commentText, vendorName, companyName, scoreText) {

			var d,
				t = this,
				oView = this.getView(),
				sComments = '',
				sDocumentsList = '';

			var updateIdPointer = "/VendorSet(System='" + system + "',CompanyCode='" + companyCode + "',VendorCode='" + vendorCode + "')";

			var oPayload = {};

			oPayload.System = system;
			oPayload.CompanyCode = companyCode;
			oPayload.VendorCode = vendorCode;
			oPayload.Score = score;
			oPayload.CompanyName = companyName;
			oPayload.VendorName = vendorName;
			oPayload.ScoreText = scoreText;

			// Preparing comments

			if (commentText !== '') {

				sComments = commentText;

			}

			// Preparing documents list

			var filesValidatorTable = oView.byId("FilesValidator");
			var filesValidatorTableItems = filesValidatorTable.getItems();

			for (var i = 0; i < filesValidatorTableItems.length; i++) {

				var filesValidatorTableItem = filesValidatorTableItems[i];

				var state = filesValidatorTableItem.getCells()[4].getProperty('state');

				if (state === true) {

					if (sDocumentsList !== '') {

						sDocumentsList = sDocumentsList + '^' + filesValidatorTableItem.getCells()[1].getText() + '#' + filesValidatorTableItem.getCells()[
							3].getValue() + '@' + filesValidatorTableItem.getCells()[2].getText();
					} else {
						sDocumentsList = filesValidatorTableItem.getCells()[1].getText() + '#' + filesValidatorTableItem.getCells()[3].getValue() +
							'@' + filesValidatorTableItem.getCells()[2].getText();
					}
				}

			} // for (var i = 0; i < filesValidatorTableItems.length; i++) 

			oPayload.Comments = sComments;
			oPayload.DocumentsList = sDocumentsList;

			this.getModel().update(updateIdPointer, oPayload, {
				urlParameters: {
					Action: "saveVendor"
				},
				success: function(oData, response) {

					if (response.headers.zvndsave_ok) {

						// Saving attachments immediately
						t.uploadPendingAttachments(false);

						var vendorCodeAndName = vendorCode + ' ' + vendorName;

						d = t.getResourceBundle().getText("vendorSaveSuccess", vendorCodeAndName);

						var formattedText = new sap.m.FormattedText("FormattedText", {
							htmlText: d
						});

						var z = t.getResourceBundle().getText("success");
						sap.m.MessageBox.information(formattedText);
						t.getView().getElementBinding().refresh(true);
						var oEventBus = sap.ui.getCore().getEventBus();
						// 1. ChannelName, 2. EventName, 3. the data
						oEventBus.publish("ObjectAction", "onVendorDataChanged");

					} else {

						if (JSON.stringify(response.headers.zvndsave_delay)) {

							// Saving attachments in delayed mode
							t.uploadPendingAttachments(true);

							vendorCodeAndName = vendorCode + ' ' + vendorName;

							d = t.getResourceBundle().getText("vendorSaveDelay", vendorCodeAndName);

						}

						if (JSON.stringify(response.headers.zvndsave_fail)) {

							vendorCodeAndName = vendorCode + ' ' + vendorName;
							d = t.getResourceBundle().getText("vendorSaveFail", vendorCode);
						}

						formattedText = new sap.m.FormattedText("FormattedText", {
							htmlText: d
						});

						z = t.getResourceBundle().getText("success");
						//		sap.m.MessageBox.information(formattedText);

						sap.m.MessageBox.information(formattedText, {
							title: z,
							actions: [
								sap.m.MessageBox.Action.OK
							],
							onClose: function(s) {

								if (s === sap.m.MessageBox.Action.OK) {

									oEventBus = sap.ui.getCore().getEventBus();
									// 1. ChannelName, 2. EventName, 3. the data
									oEventBus.publish("ObjectAction", "onVendorDataChanged");

									t.getView().getElementBinding().refresh(true);
									t.getOwnerComponent().getRouter().navTo("worklist");

								}

							}
						});

					} // if (response.headers.zapproval_ok)

				}, // : function(oData, response)

				error: function() {

						d = t.getResourceBundle().getText("vendorSaveTechError", vendorCode);
						var formattedText = new sap.m.FormattedText("FormattedText", {
							htmlText: d
						});

						var z = t.getResourceBundle().getText("error");

						sap.m.MessageBox.information(formattedText, {
							title: z,
							actions: [
								sap.m.MessageBox.Action.OK
							],
							onClose: function(s) {

								if (s === sap.m.MessageBox.Action.OK) {

									t.getView().getElementBinding().refresh(true);
									t.getOwnerComponent().getRouter().navTo("worklist");

								}

							}
						});

					} //  error: function()
			}); // this.getModel().update

		},

		_onFileNamePress: function(oEvent) {

			// Picking document ID
			var documentId = oEvent.getSource().getProperty("documentId");

			// Picking vendor code and system

			var oView = this.getView(),
				oElementBinding = oView.getElementBinding(),
				sPath = oElementBinding.getPath(),
				oObject = oView.getModel().getObject(sPath),
				vendorCode = oObject.VendorCode,
				system = oObject.System,
				companyCode = oObject.CompanyCode;

			var fileName = oEvent.getSource().getProperty("fileName");

			var readIdPointer = "/AttachmentsSet(System='" + system + "',documentId='" + documentId + "',VendorCode='" + vendorCode +
				"',CompanyCode='" + companyCode + "',fileName='" + fileName + "')/$value";

			window.open("/sap/opu/odata/sap/ZVENDORS_SCORES_SRV" + readIdPointer);

		},

		filenameLengthExceed: function(oEvent) {

			var d = this.getResourceBundle().getText("filenameLengthExceed");
			sap.m.MessageBox.error(d);
		},

		onUploadComplete: function(oEvent) {

			var oUploadCollection = this.getView().byId('attachmentCollection');
			var sEventUploaderID = oEvent.getParameters().getParameters().id;

			// Remove the File Uploader instance from upload collection reference
			// Required only for not instant upload

			for (var i = 0; i < oUploadCollection._aFileUploadersForPendingUpload.length; i++) {
				var sPendingUploadederID = oUploadCollection._aFileUploadersForPendingUpload[i].oFileUpload.id;
				if (sPendingUploadederID.includes(sEventUploaderID)) {
					oUploadCollection._aFileUploadersForPendingUpload[i].destroy();
					oUploadCollection._aFileUploadersForPendingUpload.splice([i], 1);
				}
			}

			this.getView().byId("attachmentCollection").getBinding("items").refresh();
			this.getModel("appView").setProperty("/busy", false);

		},

		onChange: function(oEvent) {

			var oView = this.getView(),
				oElementBinding = oView.getElementBinding(),
				sPath = oElementBinding.getPath(),
				oObject = oView.getModel().getObject(sPath),
				vendorCode = oObject.VendorCode,
				system = oObject.System,
				companyCode = oObject.CompanyCode;

			var readIdPointer = "/AttachmentsSet";

			var oUploadCollection = this.getView().byId('attachmentCollection');

			var sFileName = oEvent.getParameters().getParameter("files")[0].name;

			var sGUID = oEvent.getParameters().getParameter("files")[0].lastModified;

			var sSecurityToken = this.getModel().getSecurityToken();

			//	var sSecurityToken = this.getModel().refreshSecurityToken();
			var oSecurityParameter = new sap.m.UploadCollectionParameter({
				name: "x-csrf-token",
				value: sSecurityToken
			});

			var oSlugParameter = new sap.m.UploadCollectionParameter({
				name: "slug",
				value: system + "|" + vendorCode + "|" + sFileName + "|" + companyCode + "|" + sGUID
			});

			// For instant upload
			var sUploadURL = this.getModel().sServiceUrl + readIdPointer;

			oUploadCollection.setUploadUrl(sUploadURL);
			oUploadCollection.addHeaderParameter(oSecurityParameter);
			oUploadCollection.addHeaderParameter(oSlugParameter);

		},

		_onBindingChange: function() {
			var oView = this.getView(),
				oViewModel = this.getModel("objectView"),
				oElementBinding = oView.getElementBinding();

			// No data for the binding
			if (!oElementBinding.getBoundContext()) {
				this.getRouter().getTargets().display("objectNotFound");
				return;
			}

			var oResourceBundle = this.getResourceBundle(),
				oObject = oView.getBindingContext().getObject(),
				sObjectId = oObject.VendorCode,
				sObjectName = oObject.VendorName;

			oViewModel.setProperty("/busy", false);
			// Add the object page to the flp routing history
			this.addHistoryEntry({
				title: this.getResourceBundle().getText("objectTitle") + " - " + sObjectName,
				icon: "sap-icon://enter-more",
				intent: "#VendorsScores-display&/VendorSet/" + sObjectId
			});

			// Cleaning all user changes in file validator
			this.filesValuesMatrix = [];
			this.setScoresToInitialValues();
			this.getView().byId('activateWeightChange').setProperty("pressed", false);

			oViewModel.setProperty("/saveAsTileTitle", oResourceBundle.getText("saveAsTileTitle", [sObjectName]));
			oViewModel.setProperty("/shareOnJamTitle", sObjectName);
			oViewModel.setProperty("/shareSendEmailSubject",
				oResourceBundle.getText("shareSendEmailObjectSubject", [sObjectId]));
			oViewModel.setProperty("/shareSendEmailMessage",
				oResourceBundle.getText("shareSendEmailObjectMessage", [sObjectName, sObjectId, location.href]));
		}

	});

});
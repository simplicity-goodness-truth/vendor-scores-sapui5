sap.ui.define([
		"ZVNDSCR/controller/BaseController"
	], function (BaseController) {
		"use strict";

		return BaseController.extend("ZVNDSCR.controller.NotFound", {

			/**
			 * Navigates to the worklist when the link is pressed
			 * @public
			 */
			onLinkPressed : function () {
				this.getRouter().navTo("worklist");
			}

		});

	}
);
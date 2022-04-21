/*global QUnit*/

jQuery.sap.require("sap.ui.qunit.qunit-css");
jQuery.sap.require("sap.ui.thirdparty.qunit");
jQuery.sap.require("sap.ui.qunit.qunit-junit");
QUnit.config.autostart = false;

sap.ui.require([
	"sap/ui/test/Opa5",
	"ZVNDSCR/test/integration/pages/Common",
	"sap/ui/test/opaQunit",
	"ZVNDSCR/test/integration/pages/Worklist",
	"ZVNDSCR/test/integration/pages/Object",
	"ZVNDSCR/test/integration/pages/NotFound",
	"ZVNDSCR/test/integration/pages/Browser",
	"ZVNDSCR/test/integration/pages/App"
], function (Opa5, Common) {
	"use strict";
	Opa5.extendConfig({
		arrangements: new Common(),
		viewNamespace: "ZVNDSCR.view."
	});

	sap.ui.require([
		"ZVNDSCR/test/integration/WorklistJourney",
		"ZVNDSCR/test/integration/ObjectJourney",
		"ZVNDSCR/test/integration/NavigationJourney",
		"ZVNDSCR/test/integration/NotFoundJourney",
		"ZVNDSCR/test/integration/FLPIntegrationJourney"
	], function () {
		QUnit.start();
	});
});
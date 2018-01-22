(function(sites) {
	/**
	 * Mangaichi Scanlation Division (FoolSlide)
	 * @type {SiteObject}
	 */
	sites['mangaichiscans.mokkori.fr'] = {
		preInit : function(callback) {
			this.foolSlideBaseURL = this.https+'://mangaichiscans.mokkori.fr/fs';
			this.setupFoolSlide();
			callback();
		}
	};
})(window.trackerSites = (window.trackerSites || {}));

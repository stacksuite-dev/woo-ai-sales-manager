<?php
/**
 * Support UI Elements
 *
 * @package AISales_Sales_Manager
 */

defined( 'ABSPATH' ) || exit;

class AISales_Support_UI {
	/**
	 * Single instance
	 *
	 * @var AISales_Support_UI
	 */
	private static $instance = null;

	/**
	 * Get instance
	 *
	 * @return AISales_Support_UI
	 */
	public static function instance() {
		if ( is_null( self::$instance ) ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	/**
	 * Constructor
	 */
	private function __construct() {
		add_action( 'admin_footer', array( $this, 'render_support_modal' ) );
	}

	/**
	 * Render support modal and floating trigger
	 */
	public function render_support_modal() {
		if ( ! wp_style_is( 'aisales-admin', 'enqueued' ) ) {
			return;
		}

		include AISALES_PLUGIN_DIR . 'templates/partials/support-modal.php';
	}
}

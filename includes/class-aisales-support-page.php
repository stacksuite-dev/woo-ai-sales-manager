<?php
/**
 * Support Center Page
 *
 * Dedicated admin page for AI-powered support tickets.
 *
 * @package AISales_Sales_Manager
 */

defined( 'ABSPATH' ) || exit;

class AISales_Support_Page {
	/**
	 * Single instance
	 *
	 * @var AISales_Support_Page
	 */
	private static $instance = null;

	/**
	 * Get instance
	 *
	 * @return AISales_Support_Page
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
		add_action( 'admin_menu', array( $this, 'add_submenu_page' ), 99 );
	}

	/**
	 * Add submenu page under AI Sales Manager
	 */
	public function add_submenu_page() {
		add_submenu_page(
			'ai-sales-manager',
			__( 'Support Center', 'ai-sales-manager-for-woocommerce' ),
			__( 'Support Center', 'ai-sales-manager-for-woocommerce' ),
			'manage_woocommerce',
			'ai-sales-support',
			array( $this, 'render_page' )
		);
	}

	/**
	 * Render the page
	 */
	public function render_page() {
		$api_key = get_option( 'aisales_api_key' );
		$balance = get_option( 'aisales_balance', 0 );
		$tickets = array();
		$stats = array(
			'open'     => 0,
			'pending'  => 0,
			'resolved' => 0,
			'average'  => '-',
		);

		if ( ! empty( $api_key ) ) {
			$api = AISales_API_Client::instance();
			$ticket_response = $api->get_support_tickets();
			$stats_response  = $api->get_support_stats();

			if ( ! is_wp_error( $ticket_response ) && isset( $ticket_response['tickets'] ) ) {
				$tickets = $ticket_response['tickets'];
			}

			if ( ! is_wp_error( $stats_response ) ) {
				$stats = array_merge( $stats, $stats_response );
			}
		}

		include AISALES_PLUGIN_DIR . 'templates/admin-support-page.php';
	}
}

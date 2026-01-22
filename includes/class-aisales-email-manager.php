<?php
/**
 * Email Template Manager
 *
 * Manages AI-generated email templates and integrates with WooCommerce emails.
 *
 * @package AISales_Sales_Manager
 */

defined( 'ABSPATH' ) || exit;

/**
 * Email Manager class
 */
class AISales_Email_Manager {

	/**
	 * Single instance
	 *
	 * @var AISales_Email_Manager
	 */
	private static $instance = null;

	/**
	 * Option key for storing email templates
	 *
	 * @var string
	 */
	const OPTION_KEY = 'aisales_email_templates';

	/**
	 * Supported email template types
	 *
	 * @var array
	 */
	private $template_types = array(
		'order_processing' => array(
			'label'       => 'Order Processing',
			'description' => 'Sent when a new order is received and payment is confirmed',
			'wc_email_id' => 'customer_processing_order',
			'is_mvp'      => true,
		),
		'order_shipped' => array(
			'label'       => 'Order Shipped',
			'description' => 'Sent when an order is marked as shipped with tracking info',
			'wc_email_id' => 'customer_note',
			'is_mvp'      => true,
		),
		'order_completed' => array(
			'label'       => 'Order Completed',
			'description' => 'Sent when an order is marked as complete',
			'wc_email_id' => 'customer_completed_order',
			'is_mvp'      => true,
		),
	);

	/**
	 * Available placeholders for email templates
	 *
	 * @var array
	 */
	private $placeholders = array(
		'customer'  => array(
			'{customer_name}'       => 'Full customer name',
			'{customer_first_name}' => 'Customer first name',
			'{customer_last_name}'  => 'Customer last name',
			'{customer_email}'      => 'Customer email address',
		),
		'order'     => array(
			'{order_number}'          => 'WooCommerce order number',
			'{order_date}'            => 'Date order was placed',
			'{order_total}'           => 'Total order amount with currency',
			'{order_subtotal}'        => 'Subtotal before shipping/tax',
			'{order_shipping_total}'  => 'Shipping cost',
			'{order_tax_total}'       => 'Tax amount',
			'{order_payment_method}'  => 'How customer paid',
			'{order_shipping_method}' => 'Selected shipping method',
			'{order_status}'          => 'Current order status',
		),
		'address'   => array(
			'{billing_address}'       => 'Full billing address',
			'{shipping_address}'      => 'Full shipping address',
			'{billing_first_name}'    => 'Billing first name',
			'{billing_last_name}'     => 'Billing last name',
			'{shipping_first_name}'   => 'Shipping first name',
			'{shipping_last_name}'    => 'Shipping last name',
		),
		'tracking'  => array(
			'{tracking_number}' => 'Shipment tracking number',
			'{tracking_url}'    => 'Link to track shipment',
			'{carrier_name}'    => 'Shipping carrier name',
		),
		'store'     => array(
			'{store_name}'  => 'Your store name',
			'{store_url}'   => 'Your store website URL',
			'{store_email}' => 'Store contact email',
			'{store_phone}' => 'Store contact phone',
		),
		'content'   => array(
			'{order_items}'       => 'Formatted list of ordered items',
			'{order_items_table}' => 'HTML table of ordered items',
		),
	);

	/**
	 * Get instance
	 *
	 * @return AISales_Email_Manager
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
		// Hook into WooCommerce emails
		add_action( 'init', array( $this, 'init_email_hooks' ) );
	}

	/**
	 * Initialize WooCommerce email hooks
	 */
	public function init_email_hooks() {
		// Only hook if WooCommerce is active and we have templates enabled
		if ( ! class_exists( 'WooCommerce' ) ) {
			return;
		}

		// Subject filters
		add_filter( 'woocommerce_email_subject_customer_processing_order', array( $this, 'filter_processing_subject' ), 10, 2 );
		add_filter( 'woocommerce_email_subject_customer_completed_order', array( $this, 'filter_completed_subject' ), 10, 2 );

		// Heading filters
		add_filter( 'woocommerce_email_heading_customer_processing_order', array( $this, 'filter_processing_heading' ), 10, 2 );
		add_filter( 'woocommerce_email_heading_customer_completed_order', array( $this, 'filter_completed_heading' ), 10, 2 );

		// Content hooks - inject custom content before order table
		add_action( 'woocommerce_email_before_order_table', array( $this, 'inject_custom_content' ), 10, 4 );
	}

	/**
	 * Get all stored templates
	 *
	 * @return array
	 */
	public function get_templates() {
		$templates = get_option( self::OPTION_KEY, array() );
		return is_array( $templates ) ? $templates : array();
	}

	/**
	 * Get a specific template by type
	 *
	 * @param string $template_type The template type (e.g., 'order_processing').
	 * @return array|null Template data or null if not found.
	 */
	public function get_template( $template_type ) {
		$templates = $this->get_templates();
		return isset( $templates[ $template_type ] ) ? $templates[ $template_type ] : null;
	}

	/**
	 * Get the active/default template for a type
	 *
	 * @param string $template_type The template type.
	 * @return array|null Active template or null if none active.
	 */
	public function get_active_template( $template_type ) {
		$template = $this->get_template( $template_type );
		
		if ( $template && isset( $template['status'] ) && 'active' === $template['status'] ) {
			return $template;
		}

		return null;
	}

	/**
	 * Save a template
	 *
	 * @param string $template_type The template type.
	 * @param array  $template_data Template data (subject, heading, content, etc.).
	 * @return bool Success status.
	 */
	public function save_template( $template_type, $template_data ) {
		if ( ! isset( $this->template_types[ $template_type ] ) ) {
			return false;
		}

		$templates = $this->get_templates();

		$templates[ $template_type ] = array(
			'name'       => isset( $template_data['name'] ) ? sanitize_text_field( $template_data['name'] ) : '',
			'subject'    => isset( $template_data['subject'] ) ? sanitize_text_field( $template_data['subject'] ) : '',
			'heading'    => isset( $template_data['heading'] ) ? sanitize_text_field( $template_data['heading'] ) : '',
			'content'    => isset( $template_data['content'] ) ? wp_kses_post( $template_data['content'] ) : '',
			'status'     => isset( $template_data['status'] ) ? sanitize_key( $template_data['status'] ) : 'draft',
			'updated_at' => current_time( 'mysql' ),
			'created_at' => isset( $templates[ $template_type ]['created_at'] ) 
				? $templates[ $template_type ]['created_at'] 
				: current_time( 'mysql' ),
		);

		return update_option( self::OPTION_KEY, $templates );
	}

	/**
	 * Delete a template
	 *
	 * @param string $template_type The template type.
	 * @return bool Success status.
	 */
	public function delete_template( $template_type ) {
		$templates = $this->get_templates();

		if ( isset( $templates[ $template_type ] ) ) {
			unset( $templates[ $template_type ] );
			return update_option( self::OPTION_KEY, $templates );
		}

		return false;
	}

	/**
	 * Enable a template (set status to active)
	 *
	 * @param string $template_type The template type.
	 * @return bool Success status.
	 */
	public function enable_template( $template_type ) {
		$template = $this->get_template( $template_type );
		
		if ( ! $template ) {
			return false;
		}

		$template['status'] = 'active';
		return $this->save_template( $template_type, $template );
	}

	/**
	 * Disable a template (set status to disabled)
	 *
	 * @param string $template_type The template type.
	 * @return bool Success status.
	 */
	public function disable_template( $template_type ) {
		$template = $this->get_template( $template_type );
		
		if ( ! $template ) {
			return false;
		}

		$template['status'] = 'disabled';
		return $this->save_template( $template_type, $template );
	}

	/**
	 * Replace placeholders in template with actual order data
	 *
	 * @param string   $template The template string with placeholders.
	 * @param WC_Order $order    The WooCommerce order object.
	 * @param array    $extra    Extra placeholder values (e.g., tracking info).
	 * @return string Template with placeholders replaced.
	 */
	public function replace_placeholders( $template, $order, $extra = array() ) {
		$replacements = $this->get_placeholder_values( $order, $extra );

		foreach ( $replacements as $placeholder => $value ) {
			$template = str_replace( $placeholder, $value, $template );
		}

		return $template;
	}

	/**
	 * Get placeholder values from an order
	 *
	 * @param WC_Order $order The WooCommerce order object.
	 * @param array    $extra Extra placeholder values.
	 * @return array Placeholder => value pairs.
	 */
	public function get_placeholder_values( $order, $extra = array() ) {
		$values = array(
			// Customer
			'{customer_name}'       => $order->get_formatted_billing_full_name(),
			'{customer_first_name}' => $order->get_billing_first_name(),
			'{customer_last_name}'  => $order->get_billing_last_name(),
			'{customer_email}'      => $order->get_billing_email(),

			// Order
			'{order_number}'          => $order->get_order_number(),
			'{order_date}'            => wc_format_datetime( $order->get_date_created() ),
			'{order_total}'           => $order->get_formatted_order_total(),
			'{order_subtotal}'        => wc_price( $order->get_subtotal() ),
			'{order_shipping_total}'  => wc_price( $order->get_shipping_total() ),
			'{order_tax_total}'       => wc_price( $order->get_total_tax() ),
			'{order_payment_method}'  => $order->get_payment_method_title(),
			'{order_shipping_method}' => $order->get_shipping_method(),
			'{order_status}'          => wc_get_order_status_name( $order->get_status() ),

			// Address
			'{billing_address}'      => $order->get_formatted_billing_address(),
			'{shipping_address}'     => $order->get_formatted_shipping_address(),
			'{billing_first_name}'   => $order->get_billing_first_name(),
			'{billing_last_name}'    => $order->get_billing_last_name(),
			'{shipping_first_name}'  => $order->get_shipping_first_name(),
			'{shipping_last_name}'   => $order->get_shipping_last_name(),

			// Tracking (from extra or empty)
			'{tracking_number}' => isset( $extra['tracking_number'] ) ? $extra['tracking_number'] : '',
			'{tracking_url}'    => isset( $extra['tracking_url'] ) ? $extra['tracking_url'] : '',
			'{carrier_name}'    => isset( $extra['carrier_name'] ) ? $extra['carrier_name'] : '',

			// Store
			'{store_name}'  => get_bloginfo( 'name' ),
			'{store_url}'   => home_url(),
			'{store_email}' => get_option( 'woocommerce_email_from_address' ),
			'{store_phone}' => get_option( 'woocommerce_store_phone', '' ),

			// Content
			'{order_items}'       => $this->get_order_items_text( $order ),
			'{order_items_table}' => $this->get_order_items_table( $order ),
		);

		// Merge with any extra values
		return array_merge( $values, $extra );
	}

	/**
	 * Get order items as text
	 *
	 * @param WC_Order $order The order object.
	 * @return string Formatted text list of items.
	 */
	private function get_order_items_text( $order ) {
		$items = array();
		
		foreach ( $order->get_items() as $item ) {
			$qty   = $item->get_quantity();
			$name  = $item->get_name();
			$total = wc_price( $item->get_total() );
			$items[] = sprintf( '%dx %s (%s)', $qty, $name, $total );
		}

		return implode( ', ', $items );
	}

	/**
	 * Get order items as HTML table
	 *
	 * @param WC_Order $order The order object.
	 * @return string HTML table of items.
	 */
	private function get_order_items_table( $order ) {
		ob_start();
		?>
		<table style="width:100%;border-collapse:collapse;margin:16px 0;">
			<thead>
				<tr style="background:#f5f5f5;">
					<th style="padding:12px;text-align:left;border-bottom:1px solid #ddd;"><?php esc_html_e( 'Product', 'ai-sales-manager-for-woocommerce' ); ?></th>
					<th style="padding:12px;text-align:center;border-bottom:1px solid #ddd;"><?php esc_html_e( 'Qty', 'ai-sales-manager-for-woocommerce' ); ?></th>
					<th style="padding:12px;text-align:right;border-bottom:1px solid #ddd;"><?php esc_html_e( 'Price', 'ai-sales-manager-for-woocommerce' ); ?></th>
				</tr>
			</thead>
			<tbody>
				<?php foreach ( $order->get_items() as $item ) : ?>
					<tr>
						<td style="padding:12px;border-bottom:1px solid #eee;"><?php echo esc_html( $item->get_name() ); ?></td>
						<td style="padding:12px;text-align:center;border-bottom:1px solid #eee;"><?php echo esc_html( $item->get_quantity() ); ?></td>
						<td style="padding:12px;text-align:right;border-bottom:1px solid #eee;"><?php echo wc_price( $item->get_total() ); ?></td>
					</tr>
				<?php endforeach; ?>
			</tbody>
		</table>
		<?php
		return ob_get_clean();
	}

	/**
	 * Filter processing order email subject
	 *
	 * @param string   $subject Default subject.
	 * @param WC_Order $order   Order object.
	 * @return string Filtered subject.
	 */
	public function filter_processing_subject( $subject, $order ) {
		$template = $this->get_active_template( 'order_processing' );
		
		if ( $template && ! empty( $template['subject'] ) ) {
			return $this->replace_placeholders( $template['subject'], $order );
		}

		return $subject;
	}

	/**
	 * Filter completed order email subject
	 *
	 * @param string   $subject Default subject.
	 * @param WC_Order $order   Order object.
	 * @return string Filtered subject.
	 */
	public function filter_completed_subject( $subject, $order ) {
		$template = $this->get_active_template( 'order_completed' );
		
		if ( $template && ! empty( $template['subject'] ) ) {
			return $this->replace_placeholders( $template['subject'], $order );
		}

		return $subject;
	}

	/**
	 * Filter processing order email heading
	 *
	 * @param string   $heading Default heading.
	 * @param WC_Order $order   Order object.
	 * @return string Filtered heading.
	 */
	public function filter_processing_heading( $heading, $order ) {
		$template = $this->get_active_template( 'order_processing' );
		
		if ( $template && ! empty( $template['heading'] ) ) {
			return $this->replace_placeholders( $template['heading'], $order );
		}

		return $heading;
	}

	/**
	 * Filter completed order email heading
	 *
	 * @param string   $heading Default heading.
	 * @param WC_Order $order   Order object.
	 * @return string Filtered heading.
	 */
	public function filter_completed_heading( $heading, $order ) {
		$template = $this->get_active_template( 'order_completed' );
		
		if ( $template && ! empty( $template['heading'] ) ) {
			return $this->replace_placeholders( $template['heading'], $order );
		}

		return $heading;
	}

	/**
	 * Inject custom content before order table in emails
	 *
	 * @param WC_Order $order         Order object.
	 * @param bool     $sent_to_admin Is sent to admin.
	 * @param bool     $plain_text    Is plain text email.
	 * @param WC_Email $email         Email object.
	 */
	public function inject_custom_content( $order, $sent_to_admin, $plain_text, $email ) {
		// Only apply to customer emails
		if ( $sent_to_admin ) {
			return;
		}

		// Determine template type based on email ID
		$template_type = null;
		
		if ( 'customer_processing_order' === $email->id ) {
			$template_type = 'order_processing';
		} elseif ( 'customer_completed_order' === $email->id ) {
			$template_type = 'order_completed';
		}

		if ( ! $template_type ) {
			return;
		}

		$template = $this->get_active_template( $template_type );

		if ( ! $template || empty( $template['content'] ) ) {
			return;
		}

		$content = $this->replace_placeholders( $template['content'], $order );

		// Convert line breaks to HTML for HTML emails
		if ( ! $plain_text ) {
			$content = wpautop( $content );
		}

		echo wp_kses_post( $content );
	}

	/**
	 * Get template types with metadata
	 *
	 * @param bool $mvp_only Return only MVP types.
	 * @return array Template type data.
	 */
	public function get_template_types( $mvp_only = false ) {
		if ( $mvp_only ) {
			return array_filter( $this->template_types, function( $type ) {
				return isset( $type['is_mvp'] ) && $type['is_mvp'];
			} );
		}

		return $this->template_types;
	}

	/**
	 * Get all placeholder groups
	 *
	 * @return array Placeholder groups with descriptions.
	 */
	public function get_placeholders() {
		return $this->placeholders;
	}

	/**
	 * Get default sample order data for preview
	 *
	 * @return array Sample order data.
	 */
	public function get_sample_order_data() {
		return array(
			'{customer_name}'        => 'Sarah Johnson',
			'{customer_first_name}'  => 'Sarah',
			'{customer_last_name}'   => 'Johnson',
			'{customer_email}'       => 'sarah.johnson@example.com',
			'{order_number}'         => '#1234',
			'{order_date}'           => wp_date( get_option( 'date_format' ) ),
			'{order_total}'          => wc_price( 124.97 ),
			'{order_subtotal}'       => wc_price( 109.98 ),
			'{order_shipping_total}' => wc_price( 9.99 ),
			'{order_tax_total}'      => wc_price( 5.00 ),
			'{order_payment_method}' => 'Credit Card (Visa ending in 4242)',
			'{order_shipping_method}'=> 'Standard Shipping (5-7 business days)',
			'{order_status}'         => 'Processing',
			'{billing_address}'      => '123 Main Street, Apt 4B, New York, NY 10001, United States',
			'{shipping_address}'     => '456 Oak Avenue, Suite 100, Los Angeles, CA 90001, United States',
			'{billing_first_name}'   => 'Sarah',
			'{billing_last_name}'    => 'Johnson',
			'{shipping_first_name}'  => 'Sarah',
			'{shipping_last_name}'   => 'Johnson',
			'{tracking_number}'      => '1Z999AA10123456784',
			'{tracking_url}'         => 'https://www.ups.com/track?tracknum=1Z999AA10123456784',
			'{carrier_name}'         => 'UPS',
			'{store_name}'           => get_bloginfo( 'name' ),
			'{store_url}'            => home_url(),
			'{store_email}'          => get_option( 'woocommerce_email_from_address', get_option( 'admin_email' ) ),
			'{store_phone}'          => get_option( 'woocommerce_store_phone', '(555) 123-4567' ),
			'{order_items}'          => '1x Wireless Bluetooth Headphones ($79.99), 1x Phone Case - Black ($29.99)',
			'{order_items_table}'    => $this->get_sample_order_items_table(),
		);
	}

	/**
	 * Get sample order items table HTML
	 *
	 * @return string Sample items table HTML.
	 */
	private function get_sample_order_items_table() {
		return '<table style="width:100%;border-collapse:collapse;margin:16px 0;">
			<thead>
				<tr style="background:#f5f5f5;">
					<th style="padding:12px;text-align:left;border-bottom:1px solid #ddd;">' . esc_html__( 'Product', 'ai-sales-manager-for-woocommerce' ) . '</th>
					<th style="padding:12px;text-align:center;border-bottom:1px solid #ddd;">' . esc_html__( 'Qty', 'ai-sales-manager-for-woocommerce' ) . '</th>
					<th style="padding:12px;text-align:right;border-bottom:1px solid #ddd;">' . esc_html__( 'Price', 'ai-sales-manager-for-woocommerce' ) . '</th>
				</tr>
			</thead>
			<tbody>
				<tr>
					<td style="padding:12px;border-bottom:1px solid #eee;">Wireless Bluetooth Headphones</td>
					<td style="padding:12px;text-align:center;border-bottom:1px solid #eee;">1</td>
					<td style="padding:12px;text-align:right;border-bottom:1px solid #eee;">' . wc_price( 79.99 ) . '</td>
				</tr>
				<tr>
					<td style="padding:12px;border-bottom:1px solid #eee;">Phone Case - Black</td>
					<td style="padding:12px;text-align:center;border-bottom:1px solid #eee;">1</td>
					<td style="padding:12px;text-align:right;border-bottom:1px solid #eee;">' . wc_price( 29.99 ) . '</td>
				</tr>
			</tbody>
		</table>';
	}

	/**
	 * Preview a template with sample data
	 *
	 * @param array $template Template data with subject, heading, content.
	 * @param array $custom_data Optional custom sample data overrides.
	 * @return array Preview data with replaced placeholders.
	 */
	public function preview_template( $template, $custom_data = array() ) {
		$sample_data = array_merge( $this->get_sample_order_data(), $custom_data );

		$preview = array(
			'subject' => '',
			'heading' => '',
			'content' => '',
		);

		if ( isset( $template['subject'] ) ) {
			$preview['subject'] = str_replace( 
				array_keys( $sample_data ), 
				array_values( $sample_data ), 
				$template['subject'] 
			);
		}

		if ( isset( $template['heading'] ) ) {
			$preview['heading'] = str_replace( 
				array_keys( $sample_data ), 
				array_values( $sample_data ), 
				$template['heading'] 
			);
		}

		if ( isset( $template['content'] ) ) {
			$preview['content'] = str_replace( 
				array_keys( $sample_data ), 
				array_values( $sample_data ), 
				$template['content'] 
			);
		}

		return $preview;
	}

	/**
	 * Get templates overview for admin display
	 *
	 * @return array Template overview with status indicators.
	 */
	public function get_templates_overview() {
		$overview = array();
		$templates = $this->get_templates();

		foreach ( $this->template_types as $type => $meta ) {
			$overview[ $type ] = array(
				'type'        => $type,
				'label'       => $meta['label'],
				'description' => $meta['description'],
				'is_mvp'      => $meta['is_mvp'],
				'has_template' => isset( $templates[ $type ] ),
				'is_active'   => isset( $templates[ $type ] ) && 'active' === $templates[ $type ]['status'],
				'template'    => isset( $templates[ $type ] ) ? $templates[ $type ] : null,
			);
		}

		return $overview;
	}
}

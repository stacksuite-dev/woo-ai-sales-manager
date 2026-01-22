<?php
/**
 * Balance Indicator Partial
 *
 * Displays the token balance pill indicator used in page headers.
 * JavaScript in admin.js automatically makes it clickable and adds
 * low balance warning state when balance < 1000.
 *
 * Expected variable:
 * - $balance (int) - Current token balance
 *
 * @package AISales_Sales_Manager
 */

defined( 'ABSPATH' ) || exit;

// Get balance from parent template or default to 0.
$aisales_balance = isset( $balance ) ? (int) $balance : 0;
?>
<span class="aisales-balance-indicator">
	<span class="dashicons dashicons-money-alt"></span>
	<span id="aisales-balance-display"><?php echo esc_html( number_format( $aisales_balance ) ); ?></span>
	<?php esc_html_e( 'tokens', 'ai-sales-manager-for-woocommerce' ); ?>
</span>

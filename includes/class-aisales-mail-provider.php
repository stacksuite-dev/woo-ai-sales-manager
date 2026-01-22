<?php
/**
 * Mail Provider Settings
 *
 * Configure outbound email provider (SMTP or default).
 *
 * @package AISales_Sales_Manager
 */

defined( 'ABSPATH' ) || exit;

/**
 * Mail Provider class
 */
class AISales_Mail_Provider {

	/**
	 * Option key for storing mail provider settings.
	 *
	 * @var string
	 */
	const OPTION_KEY = 'aisales_mail_provider_settings';

	/**
	 * Single instance.
	 *
	 * @var AISales_Mail_Provider
	 */
	private static $instance = null;

	/**
	 * Get instance.
	 *
	 * @return AISales_Mail_Provider
	 */
	public static function instance() {
		if ( is_null( self::$instance ) ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	/**
	 * Constructor.
	 */
	private function __construct() {
		add_action( 'phpmailer_init', array( $this, 'configure_phpmailer' ) );
	}

	/**
	 * Get current mail provider settings.
	 *
	 * @return array
	 */
	public function get_settings() {
		$defaults = $this->get_default_settings();
		$settings = get_option( self::OPTION_KEY, array() );

		if ( ! is_array( $settings ) ) {
			$settings = array();
		}

		return $this->merge_provider_settings(
			wp_parse_args( $settings, $defaults ),
			$defaults
		);
	}

	/**
	 * Save mail provider settings.
	 *
	 * @param array $settings Settings to save.
	 * @return bool
	 */
	public function save_settings( $settings ) {
		$sanitized = $this->sanitize_settings( $settings );
		return update_option( self::OPTION_KEY, $sanitized );
	}

	/**
	 * Configure PHPMailer based on selected provider.
	 *
	 * @param PHPMailer $phpmailer PHPMailer instance.
	 */
	public function configure_phpmailer( $phpmailer ) {
		$settings = $this->get_settings();
		$provider = $settings['provider'] ?? 'default';

		if ( 'default' === $provider ) {
			return;
		}

		$config = $this->get_provider_smtp_config( $provider, $settings );
		if ( empty( $config ) ) {
			return;
		}

		$this->apply_smtp_config( $phpmailer, $config );
	}

	/**
	 * Get SMTP configuration for a provider.
	 *
	 * @param string $provider Provider key.
	 * @param array  $settings All settings.
	 * @return array|null SMTP config or null if invalid/incomplete.
	 */
	private function get_provider_smtp_config( $provider, $settings ) {
		$provider_settings = $settings[ $provider ] ?? array();

		switch ( $provider ) {
			case 'smtp':
				return $this->get_custom_smtp_config( $provider_settings );

			case 'sendgrid':
				$api_key = $provider_settings['api_key'] ?? '';
				if ( empty( $api_key ) ) {
					return null;
				}
				return array(
					'host'       => 'smtp.sendgrid.net',
					'port'       => 587,
					'encryption' => 'tls',
					'username'   => 'apikey',
					'password'   => $api_key,
					'from_email' => $provider_settings['from_email'] ?? '',
					'from_name'  => $provider_settings['from_name'] ?? '',
				);

			case 'resend':
				$api_key = $provider_settings['api_key'] ?? '';
				if ( empty( $api_key ) ) {
					return null;
				}
				return array(
					'host'       => 'smtp.resend.com',
					'port'       => 465,
					'encryption' => 'ssl',
					'username'   => 'resend',
					'password'   => $api_key,
					'from_email' => $provider_settings['from_email'] ?? '',
					'from_name'  => $provider_settings['from_name'] ?? '',
				);

			case 'mailgun':
				$api_key = $provider_settings['api_key'] ?? '';
				$domain  = $provider_settings['domain'] ?? '';
				if ( empty( $api_key ) || empty( $domain ) ) {
					return null;
				}
				$region = $provider_settings['region'] ?? 'us';
				$host   = 'eu' === $region ? 'smtp.eu.mailgun.org' : 'smtp.mailgun.org';
				return array(
					'host'       => $host,
					'port'       => 587,
					'encryption' => 'tls',
					'username'   => 'postmaster@' . $domain,
					'password'   => $api_key,
					'from_email' => $provider_settings['from_email'] ?? '',
					'from_name'  => $provider_settings['from_name'] ?? '',
				);

			case 'postmark':
				$server_token = $provider_settings['server_token'] ?? '';
				if ( empty( $server_token ) ) {
					return null;
				}
				return array(
					'host'       => 'smtp.postmarkapp.com',
					'port'       => 587,
					'encryption' => 'tls',
					'username'   => $server_token,
					'password'   => $server_token,
					'from_email' => $provider_settings['from_email'] ?? '',
					'from_name'  => $provider_settings['from_name'] ?? '',
				);

			case 'ses':
				$access_key = $provider_settings['access_key'] ?? '';
				$secret_key = $provider_settings['secret_key'] ?? '';
				$region     = $provider_settings['region'] ?? '';
				if ( empty( $access_key ) || empty( $secret_key ) || empty( $region ) ) {
					return null;
				}
				return array(
					'host'       => 'email-smtp.' . $region . '.amazonaws.com',
					'port'       => 587,
					'encryption' => 'tls',
					'username'   => $access_key,
					'password'   => $secret_key,
					'from_email' => $provider_settings['from_email'] ?? '',
					'from_name'  => $provider_settings['from_name'] ?? '',
				);

			default:
				return null;
		}
	}

	/**
	 * Get custom SMTP configuration.
	 *
	 * @param array $smtp SMTP settings.
	 * @return array|null Config array or null if invalid.
	 */
	private function get_custom_smtp_config( $smtp ) {
		$host = $smtp['host'] ?? '';
		if ( empty( $host ) ) {
			return null;
		}

		$auth = ! empty( $smtp['auth'] );
		return array(
			'host'       => $host,
			'port'       => isset( $smtp['port'] ) ? absint( $smtp['port'] ) : 587,
			'encryption' => $smtp['encryption'] ?? 'tls',
			'auth'       => $auth,
			'username'   => $auth ? ( $smtp['username'] ?? '' ) : '',
			'password'   => $auth ? ( $smtp['password'] ?? '' ) : '',
			'from_email' => $smtp['from_email'] ?? '',
			'from_name'  => $smtp['from_name'] ?? '',
		);
	}

	/**
	 * Apply SMTP configuration to PHPMailer.
	 *
	 * @param PHPMailer $phpmailer PHPMailer instance.
	 * @param array     $config    SMTP configuration.
	 */
	private function apply_smtp_config( $phpmailer, $config ) {
		$phpmailer->isSMTP();
		$phpmailer->Host     = $config['host'];
		$phpmailer->Port     = $config['port'];
		$phpmailer->SMTPAuth = $config['auth'] ?? true;
		$phpmailer->Username = $config['username'];
		$phpmailer->Password = $config['password'];

		$encryption = $config['encryption'] ?? 'tls';
		if ( 'ssl' === $encryption ) {
			$phpmailer->SMTPSecure  = 'ssl';
			$phpmailer->SMTPAutoTLS = false;
		} elseif ( 'none' === $encryption ) {
			$phpmailer->SMTPSecure  = '';
			$phpmailer->SMTPAutoTLS = false;
		} else {
			$phpmailer->SMTPSecure  = 'tls';
			$phpmailer->SMTPAutoTLS = true;
		}

		if ( ! empty( $config['from_email'] ) ) {
			$phpmailer->From = $config['from_email'];
		}

		if ( ! empty( $config['from_name'] ) ) {
			$phpmailer->FromName = $config['from_name'];
		}
	}

	/**
	 * Get default settings.
	 *
	 * @return array
	 */
	private function get_default_settings() {
		return array(
			'provider'   => 'default',
			'smtp'       => array(
				'host'       => '',
				'port'       => 587,
				'encryption' => 'tls',
				'auth'       => true,
				'username'   => '',
				'password'   => '',
				'from_email' => '',
				'from_name'  => '',
			),
			'sendgrid'   => array(
				'api_key'    => '',
				'from_email' => '',
				'from_name'  => '',
			),
			'resend'     => array(
				'api_key'    => '',
				'domain'     => '',
				'from_email' => '',
				'from_name'  => '',
			),
			'mailgun'    => array(
				'api_key'    => '',
				'domain'     => '',
				'region'     => 'us',
				'from_email' => '',
				'from_name'  => '',
			),
			'postmark'   => array(
				'server_token' => '',
				'from_email'   => '',
				'from_name'    => '',
			),
			'ses'        => array(
				'access_key' => '',
				'secret_key' => '',
				'region'     => '',
				'from_email' => '',
				'from_name'  => '',
			),
			'updated_at' => '',
		);
	}

	/**
	 * Sanitize settings input.
	 *
	 * @param array $settings Raw settings.
	 * @return array
	 */
	private function sanitize_settings( $settings ) {
		$defaults = $this->get_default_settings();
		$settings = is_array( $settings ) ? $settings : array();

		$provider = sanitize_key( $settings['provider'] ?? 'default' );
		if ( ! in_array( $provider, $this->get_allowed_providers(), true ) ) {
			$provider = 'default';
		}

		$smtp       = is_array( $settings['smtp'] ?? null ) ? $settings['smtp'] : array();
		$encryption = sanitize_key( $smtp['encryption'] ?? 'tls' );
		if ( ! in_array( $encryption, array( 'tls', 'ssl', 'none' ), true ) ) {
			$encryption = 'tls';
		}

		return array(
			'provider'   => $provider,
			'smtp'       => $this->sanitize_smtp_settings( $smtp, $defaults['smtp'], $encryption ),
			'sendgrid'   => $this->sanitize_provider_settings( $settings['sendgrid'] ?? array(), array( 'api_key' ) ),
			'resend'     => $this->sanitize_provider_settings( $settings['resend'] ?? array(), array( 'api_key', 'domain' ) ),
			'mailgun'    => $this->sanitize_mailgun_settings( $settings['mailgun'] ?? array() ),
			'postmark'   => $this->sanitize_provider_settings( $settings['postmark'] ?? array(), array( 'server_token' ) ),
			'ses'        => $this->sanitize_provider_settings( $settings['ses'] ?? array(), array( 'access_key', 'secret_key', 'region' ) ),
			'updated_at' => current_time( 'mysql' ),
		);
	}

	/**
	 * Sanitize SMTP settings.
	 *
	 * @param array  $smtp       Raw smtp settings.
	 * @param array  $defaults   Defaults.
	 * @param string $encryption Encryption setting.
	 * @return array
	 */
	private function sanitize_smtp_settings( $smtp, $defaults, $encryption ) {
		return array(
			'host'       => sanitize_text_field( $smtp['host'] ?? '' ),
			'port'       => absint( $smtp['port'] ?? $defaults['port'] ),
			'encryption' => $encryption,
			'auth'       => ! empty( $smtp['auth'] ),
			'username'   => sanitize_text_field( $smtp['username'] ?? '' ),
			'password'   => sanitize_text_field( $smtp['password'] ?? '' ),
			'from_email' => sanitize_email( $smtp['from_email'] ?? '' ),
			'from_name'  => sanitize_text_field( $smtp['from_name'] ?? '' ),
		);
	}

	/**
	 * Merge provider settings with defaults.
	 *
	 * @param array $settings Saved settings.
	 * @param array $defaults Default settings.
	 * @return array
	 */
	private function merge_provider_settings( $settings, $defaults ) {
		$providers = array( 'smtp', 'sendgrid', 'resend', 'mailgun', 'postmark', 'ses' );
		foreach ( $providers as $provider ) {
			$settings[ $provider ] = wp_parse_args( $settings[ $provider ] ?? array(), $defaults[ $provider ] );
		}
		return $settings;
	}

	/**
	 * Get allowed provider keys.
	 *
	 * @return array
	 */
	private function get_allowed_providers() {
		return array( 'default', 'smtp', 'sendgrid', 'resend', 'mailgun', 'postmark', 'ses' );
	}

	/**
	 * Sanitize provider settings with common fields.
	 *
	 * @param array $provider     Raw provider settings.
	 * @param array $extra_fields Additional fields to sanitize.
	 * @return array
	 */
	private function sanitize_provider_settings( $provider, $extra_fields = array() ) {
		$provider = is_array( $provider ) ? $provider : array();

		$sanitized = array(
			'from_email' => sanitize_email( $provider['from_email'] ?? '' ),
			'from_name'  => sanitize_text_field( $provider['from_name'] ?? '' ),
		);

		foreach ( $extra_fields as $field ) {
			$sanitized[ $field ] = sanitize_text_field( $provider[ $field ] ?? '' );
		}

		return $sanitized;
	}

	/**
	 * Sanitize Mailgun settings with region validation.
	 *
	 * @param array $mailgun Raw mailgun settings.
	 * @return array
	 */
	private function sanitize_mailgun_settings( $mailgun ) {
		$sanitized = $this->sanitize_provider_settings( $mailgun, array( 'api_key', 'domain', 'region' ) );

		$region = $sanitized['region'];
		$sanitized['region'] = in_array( $region, array( 'us', 'eu' ), true ) ? $region : 'us';

		return $sanitized;
	}
}

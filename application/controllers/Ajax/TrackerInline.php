<?php defined('BASEPATH') or exit('No direct script access allowed');

class TrackerInline extends Auth_Controller {
	private $userID;

	public function __construct() {
		parent::__construct();

		$this->load->library('vendor/Limiter');
		$this->load->library('form_validation');

		//1000 requests per hour to either AJAX request.
		if($this->limiter->limit('tracker_general', 1000)) {
			$this->output->set_status_header('429', 'Rate limit reached'); //rate limited reached
			exit();
		}

		$this->userID = (int) $this->User->id;
	}

	public function update() {
		$this->form_validation->set_rules('id',      'Chapter ID',    'required|ctype_digit');
		$this->form_validation->set_rules('chapter', 'Chapter',   'required');

		if($this->form_validation->run() === TRUE) {
			$success = $this->Tracker_Model->updateTrackerByID($this->userID, $this->input->post('id'), $this->input->post('chapter'));

			$this->output->set_content_type('text/plain', 'UTF-8');
			$this->output->set_output("1");
		} else {
			$this->output->set_status_header('400', 'Missing/invalid parameters.');
		}
	}

	/***** IMPORT/EXPORT ******/

	public function import() {
		$this->form_validation->set_rules('list_import', 'Chapter', 'required');
	}

	public function export() {
		$trackerData = $this->Tracker_Model->export_tracker_from_user_id($this->userID);
		$this->_render_json($trackerData, TRUE);
	}
}

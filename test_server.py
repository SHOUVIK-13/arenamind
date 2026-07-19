import unittest
from unittest.mock import patch
import json
import os

# Pre-set dummy GEMINI_API_KEY environment variable for test initialization
os.environ["GEMINI_API_KEY"] = "AQ.dummy_key_for_testing"

from server import app

class ServerTestCase(unittest.TestCase):
    def setUp(self):
        self.app = app.test_client()
        self.app.testing = True

    def test_config_endpoint(self):
        response = self.app.get('/api/config')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn('has_predefined_key', data)
        self.assertTrue(data['has_predefined_key'])

    def test_stadiums_endpoint(self):
        response = self.app.get('/api/stadiums')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn('stadiums', data)
        self.assertIn('metlife', data['stadiums'])
        self.assertIn('azteca', data['stadiums'])
        self.assertIn('bcplace', data['stadiums'])

    def test_documents_endpoint(self):
        response = self.app.get('/api/documents')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIsInstance(data, list)

    def test_scores_endpoint(self):
        response = self.app.get('/api/scores?stadium=metlife')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn('fixture', data)

    def test_upload_missing_file(self):
        response = self.app.post('/api/upload')
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertIn('error', data)

    def test_incident_sop_empty(self):
        # Verify 400 response when payload is missing description
        response = self.app.post('/api/incident_sop', json={})
        self.assertEqual(response.status_code, 400)

    def test_incident_sop_valid(self):
        # Verify classification with valid description
        response = self.app.post('/api/incident_sop', json={'description': 'medical emergency Section 109'})
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data['category'], 'medical')
        self.assertEqual(data['severity'], 'high')

    def test_chat_empty_query(self):
        response = self.app.post('/api/chat', json={})
        self.assertEqual(response.status_code, 400)

    @patch('server.generate_gemini_content')
    def test_chat_valid_query(self, mock_gemini):
        mock_gemini.return_value = "Mocked answer about MetLife step-free accessibility path."
        
        response = self.app.post('/api/chat', json={'query': 'How do I find step-free wheelchair access?', 'stadium': 'metlife'})
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn('response', data)
        self.assertIn('gemini:', data['response'])
        # Assert that a source was selected from the RAG directory
        self.assertTrue(isinstance(data['context_source'], str))
        self.assertTrue(data['context_source'].endswith('.txt'))

if __name__ == '__main__':
    unittest.main()

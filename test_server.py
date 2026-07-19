"""
Unit test suite verifying the behavior of all backend API endpoints
and security constraints for the ArenaMind platform.
"""

import unittest
from unittest.mock import patch
import json
import os
import io

# Pre-set dummy GEMINI_API_KEY environment variable for test initialization
os.environ["GEMINI_API_KEY"] = "AQ.dummy_key_for_testing"

from server import app, RATE_LIMITS

class ServerTestCase(unittest.TestCase):
    """
    Test suite containing test cases to assert API responses, security headers,
    input sanitization, rate-limiting, and validation constraints.
    """

    def setUp(self):
        """Set up testing client and clear in-memory rate limits."""
        self.app = app.test_client()
        self.app.testing = True
        RATE_LIMITS.clear()

    def test_config_endpoint(self):
        """Verify the configuration endpoint returns the API key setup status."""
        response = self.app.get('/api/config')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn('has_predefined_key', data)
        self.assertTrue(data['has_predefined_key'])

    def test_stadiums_endpoint(self):
        """Verify that map topology is loaded correctly and contains essential stadium keys."""
        response = self.app.get('/api/stadiums')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn('stadiums', data)
        self.assertIn('metlife', data['stadiums'])
        self.assertIn('azteca', data['stadiums'])
        self.assertIn('bcplace', data['stadiums'])

    def test_documents_endpoint(self):
        """Verify that the documents metadata list endpoint functions correctly."""
        response = self.app.get('/api/documents')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIsInstance(data, list)

    def test_scores_endpoint(self):
        """Verify that stadium score timelines return valid fixture structures."""
        response = self.app.get('/api/scores?stadium=metlife')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn('fixture', data)

    def test_upload_missing_file(self):
        """Verify that uploading an empty request returns a 400 Bad Request."""
        response = self.app.post('/api/upload')
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertIn('error', data)

    def test_upload_oversized_file(self):
        """Verify that file uploads exceeding 2MB are blocked by the safety system."""
        # Create a mock file with size > 2MB (2,000,001 bytes)
        large_content = b"a" * (2 * 1024 * 1024 + 1)
        data = {
            'file': (io.BytesIO(large_content), 'test.txt')
        }
        response = self.app.post('/api/upload', data=data, content_type='multipart/form-data')
        self.assertEqual(response.status_code, 400)
        res_data = json.loads(response.data)
        self.assertIn('error', res_data)
        self.assertIn('limit', res_data['error'].lower())

    def test_incident_sop_empty(self):
        """Verify empty incident reporting returns 400 Bad Request."""
        response = self.app.post('/api/incident_sop', json={})
        self.assertEqual(response.status_code, 400)

    def test_incident_sop_too_long(self):
        """Verify that incident descriptions exceeding the 2000 character limit are blocked."""
        long_description = "a" * 2001
        response = self.app.post('/api/incident_sop', json={'description': long_description})
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertIn('error', data)
        self.assertIn('limit', data['error'].lower())

    def test_incident_sop_valid(self):
        """Verify incident classifications categorize descriptions accurately."""
        response = self.app.post('/api/incident_sop', json={'description': 'medical emergency Section 109'})
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data['category'], 'medical')
        self.assertEqual(data['severity'], 'high')

    def test_chat_empty_query(self):
        """Verify empty query inputs on Chat return a 400 Bad Request."""
        response = self.app.post('/api/chat', json={})
        self.assertEqual(response.status_code, 400)

    @patch('server.generate_gemini_content')
    def test_chat_valid_query(self, mock_gemini):
        """Verify RAG context lookup works and translates query requests."""
        mock_gemini.return_value = "Mocked answer about MetLife step-free accessibility path."
        
        response = self.app.post('/api/chat', json={'query': 'How do I find step-free wheelchair access?', 'stadium': 'metlife'})
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn('response', data)
        self.assertIn('gemini:', data['response'])
        self.assertTrue(isinstance(data['context_source'], str))
        self.assertTrue(data['context_source'].endswith('.txt'))

    def test_security_headers(self):
        """Assert that strict security headers are loaded on response paths."""
        response = self.app.get('/api/config')
        self.assertEqual(response.headers.get('X-Content-Type-Options'), 'nosniff')
        self.assertEqual(response.headers.get('X-Frame-Options'), 'DENY')
        self.assertEqual(response.headers.get('X-XSS-Protection'), '1; mode=block')
        self.assertEqual(response.headers.get('Strict-Transport-Security'), 'max-age=31536000; includeSubDomains')
        self.assertEqual(response.headers.get('Referrer-Policy'), 'strict-origin-when-cross-origin')
        self.assertIn('geolocation=()', response.headers.get('Permissions-Policy', ''))
        self.assertEqual(response.headers.get('Cache-Control'), 'no-store')

    def test_rate_limiting(self):
        """Verify that flooding requests to an endpoint triggers a 429 response."""
        # The upload limit is 15 requests per minute, so we hit it 16 times
        triggered = False
        for _ in range(20):
            response = self.app.post('/api/upload')
            if response.status_code == 429:
                triggered = True
                break
        self.assertTrue(triggered, "Rate limiting should have returned 429.")

if __name__ == '__main__':
    unittest.main()

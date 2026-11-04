import copy
import importlib.util
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('coach_news',Path(__file__).resolve().parents[1]/'scripts/generate_coach_news.py')
news=importlib.util.module_from_spec(spec)
spec.loader.exec_module(news)

class NewsTests(unittest.TestCase):
    def setUp(self):
        self.now=datetime(2026,11,5,tzinfo=timezone.utc)
        self.url='https://www.abc.net.au/news/sport/example'
        self.draft={'jokes':[{'text':'An original fictional sports joke for testing.', 'tone':'cheeky','topic':'sport','source':{'title':'Example sport result','url':self.url,'publishedAt':'2026-11-04T12:00:00Z'}}]}
    def test_provenance_expiry_and_stable_identity(self):
        valid=news.validate(self.draft,{self.url},self.now)
        self.assertEqual(len(valid),1)
        self.assertEqual(valid[0]['id'],news.validate(self.draft,{self.url},self.now)[0]['id'])
        self.assertLessEqual(news.stamp(valid[0]['expiresAt'])-self.now,news.timedelta(days=2))
        self.assertEqual(news.validate(self.draft,set(),self.now),[])
        self.draft['jokes'][0]['source']['publishedAt']='2020-01-01T00:00:00Z'
        self.assertEqual(news.validate(self.draft,{self.url},self.now),[])
    def test_bad_sources_and_schema(self):
        for url in ['https://abc.net.au.evil.test/x','javascript:alert(1)','https://secret@abc.net.au/x']:
            draft=copy.deepcopy(self.draft);draft['jokes'][0]['source']['url']=url
            self.assertEqual(news.validate(draft,{url},self.now),[])
        self.draft['jokes'][0]['tone']='off'
        self.assertEqual(news.validate(self.draft,{self.url},self.now),[])
    def test_editor_must_retrieve_and_approve_the_source(self):
        identity=news.validate(self.draft,{self.url},self.now)[0]['id']
        for urls,expected in [(set(),0),({self.url},1)]:
            with patch.object(news,'call_api',side_effect=[(self.draft,{self.url}),({'approved':[identity]},urls)]):
                self.assertEqual(len(news.generate('fake-key',self.now)),expected)

    def test_editor_cannot_inject_unapproved_lines(self):
        with patch.object(news,'call_api',side_effect=[(self.draft,{self.url}),({'approved':['invented-id']},set())]):
            self.assertEqual(news.generate('fake-key',self.now),[])

if __name__=='__main__':unittest.main()

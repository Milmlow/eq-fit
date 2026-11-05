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
        self.draft={'jokes':[{'text':'An original fictional sports joke for testing.', 'tone':'cheeky','topic':'sport','storyKey':'example-event-2026','source':{'title':'Example sport result','url':self.url,'publishedAt':'2026-11-04T12:00:00Z'}}]}
    def test_provenance_expiry_and_stable_identity(self):
        valid=news.validate(self.draft,{self.url},self.now)
        self.assertEqual(len(valid),1)
        self.assertEqual(valid[0]['id'],news.validate(self.draft,{self.url},self.now)[0]['id'])
        self.assertLessEqual(news.stamp(valid[0]['expiresAt'])-self.now,news.timedelta(days=2))
        self.assertEqual(news.validate(self.draft,set(),self.now),[])
        self.draft['jokes'][0]['source']['publishedAt']='2020-01-01T00:00:00Z'
        self.assertEqual(news.validate(self.draft,{self.url},self.now),[])
    def test_bad_sources_and_schema(self):
        for url in ['https://abc.net.au.evil.test/x','javascript:alert(1)','https://secret@abc.net.au/x','https://www.betootaadvocate.com/example']:
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

class ClaudeResponseTests(unittest.TestCase):
    def test_search_narration_is_ignored_and_source_provenance_preserved(self):
        result={'stop_reason':'end_turn','content':[
            {'type':'text','text':'I will search now.'},
            {'type':'server_tool_use','name':'web_search'},
            {'type':'web_search_tool_result','content':[{'type':'web_search_result','url':'https://abc.net.au/a'}]},
            {'type':'text','text':'{"jokes":[]}', 'citations':[{'type':'web_search_result_location','url':'https://bbc.com/b'}]}]}
        value,urls=news.parse_response(result)
        self.assertEqual(value,{'jokes':[]})
        self.assertEqual(urls,{'https://abc.net.au/a','https://bbc.com/b'})
    def test_pause_and_truncation_fail_closed(self):
        for reason in ('pause_turn','max_tokens','refusal'):
            with self.assertRaises(ValueError):
                news.parse_response({'stop_reason':reason,'content':[{'type':'text','text':'{"jokes":[]}'}]})
    def test_failed_search_does_not_supply_sources(self):
        value,urls=news.parse_response({'stop_reason':'end_turn','content':[
            {'type':'web_search_tool_result','content':{'type':'web_search_tool_result_error','error_code':'unavailable'}},
            {'type':'text','text':'```json\n{"jokes":[]}\n```'}]})
        self.assertEqual(value,{'jokes':[]});self.assertEqual(urls,set())
    def test_request_uses_anthropic_key_and_bounded_search(self):
        from unittest.mock import MagicMock
        response=MagicMock();response.__enter__.return_value.read.return_value=b'{"stop_reason":"end_turn","content":[{"type":"text","text":"{\\"jokes\\":[]}"}]}'
        with patch.object(news,'urlopen',return_value=response) as request:
            news.call_api('test-secret','Test request',True)
        req=request.call_args.args[0];body=news.json.loads(req.data)
        self.assertEqual(req.full_url,'https://api.anthropic.com/v1/messages')
        self.assertEqual(req.get_header('X-api-key'),'test-secret')
        self.assertNotIn('Authorization',req.headers)
        self.assertEqual(body['tools'][0]['max_uses'],4)
        self.assertEqual(body['max_tokens'],6000)
        self.assertNotIn('allowed_domains',body['tools'][0])


class DiagnosticTests(unittest.TestCase):
    def test_only_fixed_labels_are_exposed(self):
        from io import BytesIO
        from urllib.error import HTTPError
        for message,label in [('Your credit balance is too low. secret-value','api_credits_required'),('anthropic-workspace-id header required','workspace_configuration'),('The following domains are not accessible to our user agent: test','news_source_configuration'),('unknown secret-value','unknown')]:
            error=HTTPError('https://api.anthropic.com',400,'Bad Request',{},BytesIO(news.json.dumps({'error':{'message':message}}).encode()))
            self.assertEqual(news.error_category(error),label)


class VarietyTests(unittest.TestCase):
    def item(self,story='melbourne-cup-2026',topic='sport',tone='cheeky',url=None):
        return {'storyKey':story,'topic':topic,'tone':tone,'source':{'url':url or 'https://abc.net.au/'+story}}
    def test_one_event_per_category_and_one_variant_per_tone(self):
        a=self.item()
        result=news.diversify([a,a,self.item(tone='friendly'),self.item('cup-fashions-2026'),self.item('press-conference-2026','politics')])
        self.assertEqual(len(result),3)
        self.assertEqual([j['topic'] for j in result],['sport','sport','politics'])
    def test_same_event_or_source_cannot_fill_multiple_categories(self):
        a=self.item()
        self.assertEqual(news.diversify([a,self.item(topic='culture'),self.item('cup-fashions-2026','everyday',url=a['source']['url'])]),[a])
    def test_invalid_event_keys_fail_closed(self):
        fixture=NewsTests();fixture.setUp()
        for key in [None,'x','bad key',123,'a-'*60+'b']:
            draft=copy.deepcopy(fixture.draft);draft['jokes'][0]['storyKey']=key
            self.assertEqual(news.validate(draft,{fixture.url},fixture.now),[])

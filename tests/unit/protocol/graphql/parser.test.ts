import { describe, expect, it } from 'vitest';
import { extractGraphQLOperation } from '@/protocol/graphql/parser';

describe('extractGraphQLOperation', () => {
  it('extracts fb_api_req_friendly_name from url-encoded string', () => {
    const body = 'fb_api_req_friendly_name=StoriesSeenMutation&variables=%7B%7D&doc_id=12345';
    expect(extractGraphQLOperation(body)).toEqual({
      friendlyName: 'StoriesSeenMutation',
      docId: '12345',
    });
  });

  it('extracts operation name when friendly_name is not the first parameter', () => {
    const body = 'doc_id=98765&fb_dtsg=NA&fb_api_req_friendly_name=StoriesSeenTrayItemMutation';
    expect(extractGraphQLOperation(body)).toEqual({
      friendlyName: 'StoriesSeenTrayItemMutation',
      docId: '98765',
    });
  });

  it('extracts from json string payload', () => {
    const body = JSON.stringify({
      fb_api_req_friendly_name: 'StoriesReaderSeenMutation',
      doc_id: '55555',
    });
    expect(extractGraphQLOperation(body)).toEqual({
      friendlyName: 'StoriesReaderSeenMutation',
      docId: '55555',
    });
  });

  it('extracts operationName if standard GraphQL JSON is used', () => {
    const body = JSON.stringify({
      operationName: 'StoriesSeenMutation',
      variables: { story_id: '123' },
    });
    expect(extractGraphQLOperation(body)).toEqual({
      friendlyName: 'StoriesSeenMutation',
      docId: undefined,
    });
  });

  it('extracts from URLSearchParams instance', () => {
    const params = new URLSearchParams();
    params.set('fb_api_req_friendly_name', 'StoriesUpdateSeenStateMutation');
    params.set('doc_id', '777');
    expect(extractGraphQLOperation(params)).toEqual({
      friendlyName: 'StoriesUpdateSeenStateMutation',
      docId: '777',
    });
  });

  it('returns null for non-graphql body or unparseable content', () => {
    expect(extractGraphQLOperation(null)).toBeNull();
    expect(extractGraphQLOperation(undefined)).toBeNull();
    expect(extractGraphQLOperation('random_text_without_graphql')).toBeNull();
  });
});

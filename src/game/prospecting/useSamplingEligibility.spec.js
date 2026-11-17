import { act, renderHook } from '@testing-library/react';
import { Entity, Extractor, Lot, Permission } from '@influenceth/sdk';
import { evaluateAuthorization, loadAuthorization } from '../../lib/authorization';
import useSamplingEligibility from './useSamplingEligibility';
import api from '~/lib/api';

let mockOrigin, mockTarget, mockAuthorize, mockRecheck;
const mockCrew = { id: 1, label: Entity.IDS.CREW, Crew: { delegatedTo: '0x123', readyAt: 100 } };
jest.mock('~/hooks/useLot', () => (id) => ({ data: id === mockOrigin?.id ? mockOrigin : mockTarget, isLoading: false }), { virtual: true });
jest.mock('~/hooks/useCrewContext', () => () => ({ crew: mockCrew,
  authorize: mockAuthorize, recheckAuthorization: mockRecheck }), { virtual: true });
jest.mock('~/lib/api', () => ({ getEntities: jest.fn() }), { virtual: true });
const input = { active: true, asteroidId: 1, originIndex: 10, selected: { lot: 11, depth: 0 } };
beforeEach(() => {
  mockOrigin = { id: Lot.toId(1, 10), label: Entity.IDS.LOT };
  mockTarget = { id: Lot.toId(1, 11), label: Entity.IDS.LOT, building: { Extractors: [] } };
  mockAuthorize = jest.fn(() => ({ status: 'allowed' }));
  mockRecheck = jest.fn(async () => ({ status: 'allowed' }));
  api.getEntities.mockResolvedValue([]);
});

it('checks permission only at the origin and rereads every extractor at the actual target', async () => {
  const { result } = renderHook(() => useSamplingEligibility(input));
  expect(result.current.disabledReason).toBeNull();
  api.getEntities.mockResolvedValue([{ Extractors: [
    { slot: 1, status: Extractor.STATUSES.IDLE },
    { slot: 2, status: Extractor.STATUSES.RUNNING, finishTime: 1 }
  ] }]);
  let reason;
  await act(async () => { reason = await result.current.recheck(); });
  expect(reason).toContain('RUNNING');
  expect(mockRecheck).toHaveBeenCalledWith('lotUsage', [mockCrew, mockOrigin], [mockCrew, mockOrigin]);
  expect(api.getEntities).toHaveBeenCalledWith({ label: Entity.IDS.BUILDING,
    match: { 'Location.locations.uuid': Entity.formatEntity({ id: mockTarget.id, label: Entity.IDS.LOT }).uuid } });
  expect(mockAuthorize.mock.calls.every(([method, [, target]]) => method === 'lotUsage' && target.id === mockOrigin.id)).toBe(true);
});

it('stops a revoked origin permission before checking the target or accepting a sample', async () => {
  const { result } = renderHook(() => useSamplingEligibility(input));
  mockRecheck.mockResolvedValue({ status: 'denied' });
  await expect(result.current.recheck()).resolves.toContain('starting lot');
  expect(api.getEntities).not.toHaveBeenCalled();
});


it('keeps unresolved display and submission checks distinct from denied access', async () => {
  mockAuthorize.mockReturnValue({ status: 'unresolved' });
  mockRecheck.mockResolvedValue({ status: 'unresolved' });
  const { result } = renderHook(() => useSamplingEligibility(input));
  expect(result.current.disabledReason).toContain('Checking');
  expect(result.current.disabledReason).not.toContain('required');
  await expect(result.current.recheck()).resolves.toContain('Checking');
  expect(api.getEntities).not.toHaveBeenCalled();
});

const record = (label, id, components = {}) => ({
  label, id, Control: null, PublicPolicies: [], WhitelistAgreements: [],
  WhitelistAccountAgreements: [], PrepaidAgreements: [], ContractAgreements: [], ...components
});

it.each(['asteroid controller', 'asteroid policy'])(
  'allows inherited origin access from the %s using the real SDK rules', async (grant) => {
    const other = record(Entity.IDS.CREW, 2, { Crew: { delegatedTo: '0x456', readyAt: 100 } });
    const asteroid = record(Entity.IDS.ASTEROID, 1, {
      Control: { controller: grant === 'asteroid controller' ? mockCrew : other },
      PublicPolicies: grant === 'asteroid policy' ? [{ permission: Permission.IDS.USE_LOT }] : []
    });
    const rawOrigin = record(Entity.IDS.LOT, mockOrigin.id, { UseLot: { tenant: null } });
    mockOrigin = { ...rawOrigin, Control: { controller: mockCrew },
      _permissionTargets: { lot: rawOrigin, asteroid } };
    const records = [mockCrew, other, asteroid, mockOrigin];
    const evaluate = (method, args) => evaluateAuthorization({ method, args, entities: records, blockTime: 100 });
    // The old direct permission check falsely denied these legitimate starting lots.
    expect(evaluate('can', [mockCrew, mockOrigin, Permission.IDS.USE_LOT]).status).toBe('denied');
    mockAuthorize.mockImplementation((method, args) => evaluate(method, args));
    mockRecheck.mockImplementation((method, args, entities) => loadAuthorization({
      method, args, entities, blockTime: 100, fresh: true,
      api: { getEntityById: async ({ label, id }) => records.find((entity) => entity.label === label && Number(entity.id) === Number(id)) }
    }));
    const { result } = renderHook(() => useSamplingEligibility(input));
    expect(result.current.disabledReason).toBeNull();
    await expect(result.current.recheck()).resolves.toBeNull();
  }
);

it('respects another active tenant even when the selected crew controls the asteroid', async () => {
  const tenant = record(Entity.IDS.CREW, 2, { Crew: { delegatedTo: '0x456', readyAt: 100 } });
  const asteroid = record(Entity.IDS.ASTEROID, 1, { Control: { controller: mockCrew } });
  mockOrigin = record(Entity.IDS.LOT, mockOrigin.id, {
    UseLot: { tenant }, PrepaidAgreements: [{
      permission: Permission.IDS.USE_LOT, permitted: tenant,
      endTime: 200, noticeTime: 0, noticePeriod: 0
    }]
  });
  const records = [mockCrew, tenant, asteroid, mockOrigin];
  mockAuthorize.mockImplementation((method, args) => evaluateAuthorization({
    method, args, entities: records, blockTime: 100
  }));
  mockRecheck.mockImplementation(async (method, args) => evaluateAuthorization({
    method, args, entities: records, blockTime: 100
  }));
  const { result } = renderHook(() => useSamplingEligibility(input));
  expect(result.current.disabledReason).toContain('starting lot');
  await expect(result.current.recheck()).resolves.toContain('starting lot');
  expect(api.getEntities).not.toHaveBeenCalled();
});

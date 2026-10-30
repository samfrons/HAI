import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./live-sources/gdacs', () => ({ fetchAlerts: vi.fn() }));
vi.mock('./live-sources/usgs', () => ({ fetchEarthquakes: vi.fn() }));
vi.mock('./live-sources/worldbank', () => ({ fetchCountryContext: vi.fn() }));
vi.mock('./live-sources/hpc', () => ({ fetchPlans: vi.fn() }));

import { getCountryHazardsBrief, getGlobalHazardsOverview, runHazardsContext } from './hazards-context';
import { fetchAlerts } from './live-sources/gdacs';
import { fetchPlans } from './live-sources/hpc';
import { fetchEarthquakes } from './live-sources/usgs';
import { fetchCountryContext } from './live-sources/worldbank';

const fetchAlertsMock = vi.mocked(fetchAlerts);
const fetchEarthquakesMock = vi.mocked(fetchEarthquakes);
const fetchPlansMock = vi.mocked(fetchPlans);
const fetchCountryContextMock = vi.mocked(fetchCountryContext);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getGlobalHazardsOverview', () => {
  it('combines all three global sources when every one succeeds', async () => {
    fetchAlertsMock.mockResolvedValue([{ source: 'GDACS' } as never]);
    fetchEarthquakesMock.mockResolvedValue([{ source: 'USGS' } as never]);
    fetchPlansMock.mockResolvedValue([{ source: 'OCHA HPC' } as never]);

    const result = await getGlobalHazardsOverview(['gdacs', 'usgs', 'hpc']);

    expect(result.errors).toEqual([]);
    expect(result.gdacsAlerts).toHaveLength(1);
    expect(result.earthquakes).toHaveLength(1);
    expect(result.responsePlans).toHaveLength(1);
    expect(fetchAlertsMock).toHaveBeenCalledWith({ minLevel: 'orange' });
  });

  it('degrades one failing source into `errors` instead of failing the whole report', async () => {
    fetchAlertsMock.mockRejectedValue(new Error('feed down'));
    fetchEarthquakesMock.mockResolvedValue([{ source: 'USGS' } as never]);
    fetchPlansMock.mockResolvedValue([]);

    const result = await getGlobalHazardsOverview(['gdacs', 'usgs', 'hpc']);

    expect(result.gdacsAlerts).toEqual([]);
    expect(result.earthquakes).toHaveLength(1);
    expect(result.errors).toEqual(['gdacs: feed down']);
  });

  it('only calls the requested sources', async () => {
    fetchEarthquakesMock.mockResolvedValue([]);
    const result = await getGlobalHazardsOverview(['usgs']);
    expect(fetchAlertsMock).not.toHaveBeenCalled();
    expect(fetchPlansMock).not.toHaveBeenCalled();
    expect(result.gdacsAlerts).toBeUndefined();
    expect(result.responsePlans).toBeUndefined();
  });

  it('caps each section to its list limit', async () => {
    fetchAlertsMock.mockResolvedValue(Array.from({ length: 25 }, () => ({}) as never));
    fetchEarthquakesMock.mockResolvedValue(Array.from({ length: 25 }, () => ({}) as never));
    fetchPlansMock.mockResolvedValue(Array.from({ length: 25 }, () => ({}) as never));

    const result = await getGlobalHazardsOverview(['gdacs', 'usgs', 'hpc']);

    expect(result.gdacsAlerts).toHaveLength(10);
    expect(result.earthquakes).toHaveLength(10);
    expect(result.responsePlans).toHaveLength(15);
  });
});

describe('getCountryHazardsBrief', () => {
  it('scopes GDACS to the country and reports World Bank context', async () => {
    fetchAlertsMock.mockResolvedValue([{ source: 'GDACS' } as never]);
    fetchCountryContextMock.mockResolvedValue([{ source: 'World Bank' } as never]);

    const result = await getCountryHazardsBrief('SDN', ['gdacs', 'worldbank']);

    expect(fetchAlertsMock).toHaveBeenCalledWith({ minLevel: 'green', countryIso3: 'SDN' });
    expect(result.countryIso3).toBe('SDN');
    expect(result.countryContext).toHaveLength(1);
    expect(result.errors).toEqual([]);
  });

  it('reports a down World Bank source in errors and empties the section', async () => {
    fetchAlertsMock.mockResolvedValue([]);
    fetchCountryContextMock.mockRejectedValue(new Error('timeout'));

    const result = await getCountryHazardsBrief('SDN', ['gdacs', 'worldbank']);

    expect(result.countryContext).toEqual([]);
    expect(result.errors).toEqual(['worldbank: timeout']);
  });
});

describe('runHazardsContext', () => {
  it('rejects an invalid country code before calling any source', async () => {
    const result = await runHazardsContext({ scope: 'country', country_iso3: 'sudan' });

    expect(fetchAlertsMock).not.toHaveBeenCalled();
    expect(result.errors[0]).toMatch(/not a valid ISO 3166-1 alpha-3 code/);
  });

  it('defaults to the global source set when none is given', async () => {
    fetchAlertsMock.mockResolvedValue([]);
    fetchEarthquakesMock.mockResolvedValue([]);
    fetchPlansMock.mockResolvedValue([]);

    const result = await runHazardsContext({ scope: 'global' });

    expect(result.scope).toBe('global');
    expect(fetchAlertsMock).toHaveBeenCalled();
    expect(fetchEarthquakesMock).toHaveBeenCalled();
    expect(fetchPlansMock).toHaveBeenCalled();
  });
});

import { X509Certificate } from 'node:crypto';
import { getCACertificates } from 'node:tls';
import { describe, expect, it } from 'vitest';
import { SECTIGO_DV_R36, trustPortalIntermediate } from '../src/core/tls.js';
import '../src/core/http.js';

const normalize = (pem: string) => pem.replace(/\s+/g, '');
const count = () => getCACertificates('default').filter((pem) => normalize(pem) === normalize(SECTIGO_DV_R36)).length;

describe('portal intermediate certificate', () => {
  it('is the Sectigo DV R36 intermediate the portal leaves out of its chain', () => {
    const cert = new X509Certificate(SECTIGO_DV_R36);
    expect(cert.subject).toContain('CN=Sectigo Public Server Authentication CA DV R36');
    expect(cert.issuer).toContain('CN=Sectigo Public Server Authentication Root R46');
    expect(cert.fingerprint256).toBe(
      '8C:54:C3:34:B6:6B:A4:E4:26:77:2A:F4:A3:F9:13:6C:19:A1:AE:C7:29:FD:B2:8C:53:5C:07:A5:A4:EF:22:E0',
    );
  });

  it('is added to the default CAs once, by loading the transport, keeping the others', () => {
    const before = getCACertificates('default').length;
    expect(count()).toBe(1);
    trustPortalIntermediate();
    expect(count()).toBe(1);
    expect(getCACertificates('default').length).toBe(before);
    expect(before).toBeGreaterThan(100);
  });
});

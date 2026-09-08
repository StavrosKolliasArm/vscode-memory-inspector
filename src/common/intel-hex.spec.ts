/********************************************************************************
 * Copyright (C) 2026 Arm Limited and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import { expect } from 'chai';
import 'mocha';

import { IntelHEX } from './intel-hex';

const REPRESENTATIVE_CAPTURE = [
    ':020000040008F2',
    ':105DC000000102030405060708090A0B0C0D0E0F5B',
    ':045DD0001011121389',
    ':020000042000DA',
    ':08100000DEADBEEF00010203AA',
    ':0400000508005DC1D1',
    ':00000001FF'
].join('\n');

const snapshot = (blocks: IntelHEX.MemoryBlock[]) => blocks.map(block => ({
    address: `0x${block.address.toString(16).toUpperCase()}`,
    bytes: Array.from(block.bytes)
}));

describe('intel-hex', () => {
    it('round-trips memory above 0x80000000', () => {
        const block: IntelHEX.MemoryBlock = {
            address: 0x800B5DC0n,
            bytes: Uint8Array.from({ length: 20 }, (_, index) => index)
        };

        const encoded = IntelHEX.encode(block);
        const decoded = IntelHEX.decode(encoded);

        expect(decoded).to.have.length(1);
        expect(decoded[0].address).to.equal(block.address);
        expect(Array.from(decoded[0].bytes)).to.deep.equal(Array.from(block.bytes));
    });

    it('splits records when data crosses a 64 KiB boundary', () => {
        const block: IntelHEX.MemoryBlock = {
            address: 0x0000FFF8n,
            bytes: Uint8Array.from({ length: 32 }, (_, index) => index)
        };

        const encoded = IntelHEX.encode(block);
        const decoded = IntelHEX.decode(encoded);

        expect(decoded).to.have.length(2);
        expect(decoded[0].address).to.equal(0x0000FFF8n);
        expect(decoded[0].bytes).to.have.length(8);
        expect(decoded[1].address).to.equal(0x00010000n);
        expect(decoded[1].bytes).to.have.length(24);
    });

    it('rejects invalid checksums', () => {
        expect(() => IntelHEX.decode(':020000040001F8\n:00000001FF\n')).to.throw('Invalid Intel HEX checksum');
    });

    it('rejects malformed hex bytes instead of parsing a valid prefix', () => {
        expect(() => IntelHEX.decode(':0000000G00\n')).to.throw("Invalid hex byte on line 1: '0G'");
    });

    it('matches the snapshot of a representative Intel HEX capture', () => {
        expect(snapshot(IntelHEX.decode(REPRESENTATIVE_CAPTURE))).to.deep.equal([
            {
                address: '0x85DC0',
                bytes: [
                    0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
                    0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F,
                    0x10, 0x11, 0x12, 0x13
                ]
            },
            {
                address: '0x20001000',
                bytes: [0xDE, 0xAD, 0xBE, 0xEF, 0x00, 0x01, 0x02, 0x03]
            }
        ]);
    });

    it('preserves the captured memory layout when re-encoded', () => {
        const decoded = IntelHEX.decode(REPRESENTATIVE_CAPTURE);

        expect(snapshot(IntelHEX.decode(IntelHEX.encode(decoded)))).to.deep.equal(snapshot(decoded));
    });
});

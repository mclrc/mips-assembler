import { parseLine } from './parser';
import { test, expect } from 'vitest';

test('parseLine - add', () => {
  const line = 'add $t0, $t1, $t2';

  const address = 0x00400000;
  const startingAddress = 0x00400000;
  const result = parseLine(line, { startingAddress, address, labels: {} });
  expect(result).toEqual({
    type: 'R',
    original: line,
    opcode: 0,
    address,
    rs: 9,
    rt: 10,
    rd: 8,
    shamt: 0,
    funct: 32,
    hex: '0x012a4020',
  });
});

test('parseLine - sub', () => {
  const line = 'sub $t0, $t1, $t2';
  const address = 0x00400004;
  const startingAddress = 0x00400000;
  const result = parseLine(line, { startingAddress, address, labels: {} });
  expect(result).toEqual({
    type: 'R',
    original: line,
    opcode: 0,
    address,
    rs: 9,
    rt: 10,
    rd: 8,
    shamt: 0,
    funct: 34,
    hex: '0x012a4022',
  });
});

test('parseLine - j', () => {
  const line = 'j L1';
  const startingAddress = 0x00400000;
  const address = 0x00400008;
  const result = parseLine(line, {
    startingAddress,
    address,
    labels: { L1: startingAddress },
  });
  expect(result).toEqual({
    type: 'J',
    original: line,
    opcode: 2,
    address,
    target: 0x00400000,
    hex: '0x08100000',
  });
});

test('parseLine - beq backward', () => {
  const line = 'beq $t0, $t1, L1';
  const startingAddress = 0x00400000;
  const address = 0x0040000c;
  const result = parseLine(line, {
    startingAddress,
    address,
    labels: { L1: startingAddress },
  });
  expect(result).toEqual({
    type: 'I',
    original: line,
    opcode: 4,
    address,
    rs: 9,
    rt: 8,
    immediate: 0xfffb,
    hex: '0x1109fffb',
  });
});

test('parseLine - beq forward', () => {
  const line = 'beqz $a1, L1';
  const startingAddress = 0x00400000;
  const address = 0x0040000c;
  const result = parseLine(line, {
    startingAddress,
    address,
    labels: { L1: address + 8 },
  });
  expect(result).toEqual({
    type: 'I',
    original: line,
    opcode: 4,
    address,
    rs: 0,
    rt: 5,
    immediate: 1,
    hex: '0x1109fffb',
  });
});

test('parseLine - lw', () => {
  const line = 'lw $s0, 0($s1)';
  const startingAddress = 0x00400000;
  const address = 0x00400010;
  const result = parseLine(line, { startingAddress, address, labels: {} });
  expect(result).toEqual({
    type: 'I',
    original: line,
    opcode: 35,
    address,
    rs: 17,
    rt: 16,
    immediate: 0,
    hex: '0x8d090000',
  });
});

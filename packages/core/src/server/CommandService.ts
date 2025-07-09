/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import express from 'express';

const execAsync = promisify(exec);

export class CommandService {
  public async executeCommand(req: express.Request, res: express.Response) {
    try {
      const { command, cwd } = req.body;
      
      if (!command) {
        return res.status(400).json({ error: 'Command is required' });
      }

      console.log('Executing command:', command, 'in directory:', cwd || process.cwd());
      
      const options: any = {};
      if (cwd) {
        options.cwd = cwd;
      }
      
      const { stdout, stderr } = await execAsync(command, options);
      
      res.json({
        command: command,
        output: stdout,
        error: stderr || null,
        exitCode: 0, // execAsync 成功时 exitCode 为 0
        timestamp: new Date().toISOString()
      });
      
    } catch (error: any) {
      console.error('Error executing command:', error);
      
      // execAsync 失败时会抛出错误，包含 stdout, stderr, code 等信息
      res.json({
        command: req.body.command,
        output: error.stdout || '',
        error: error.stderr || error.message,
        exitCode: error.code || -1,
        timestamp: new Date().toISOString()
      });
    }
  }
} 
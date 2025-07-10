/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { promises as fs } from 'fs';
import path from 'path';
import express from 'express';
import { ResponseFactory } from '../utils/responseFactory.js';

export class FileService {
  public async listDirectory(req: express.Request, res: express.Response) {
    try {
      const dirPath = req.query.path as string || '.';
      const fullPath = path.resolve(dirPath);
      const items = await fs.readdir(fullPath, { withFileTypes: true });
      const directoryItems = items.map(item => ({
        name: item.name,
        type: item.isDirectory() ? 'directory' : 'file',
        path: path.join(fullPath, item.name)
      }));
      res.json(ResponseFactory.listDirectory(fullPath, directoryItems));
    } catch (error) {
      res.status(500).json(ResponseFactory.internalError(error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  public async readFile(req: express.Request, res: express.Response) {
    try {
      const { path: filePath } = req.body;
      if (!filePath) {
        return res.status(400).json(ResponseFactory.validationError('path', 'File path is required'));
      }
      const content = await fs.readFile(filePath, 'utf-8');
      res.json(ResponseFactory.readFile(filePath, content, true));
    } catch (error) {
      res.status(500).json(ResponseFactory.readFile(req.body.path, null, false, error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  public async writeFile(req: express.Request, res: express.Response) {
    try {
      const { path: filePath, content } = req.body;
      if (!filePath || content === undefined) {
        return res.status(400).json(ResponseFactory.validationError('path/content', 'File path and content are required'));
      }
      await fs.writeFile(filePath, content, 'utf-8');
      res.json(ResponseFactory.writeFile(filePath, content, true));
    } catch (error) {
      res.status(500).json(ResponseFactory.writeFile(req.body.path, req.body.content, false, error instanceof Error ? error.message : 'Unknown error'));
    }
  }
} 
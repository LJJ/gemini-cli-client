/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { promises as fs } from 'fs';
import path from 'path';
import express from 'express';

export class FileService {
  public async listDirectory(req: express.Request, res: express.Response) {
    try {
      const dirPath = req.query.path as string || '.';
      const fullPath = path.resolve(dirPath);
      
      console.log('Listing directory:', fullPath);
      
      const items = await fs.readdir(fullPath, { withFileTypes: true });
      
      const directoryItems = items.map(item => ({
        name: item.name,
        type: item.isDirectory() ? 'directory' : 'file',
        path: path.join(fullPath, item.name)
      }));
      
      res.json({
        path: fullPath,
        items: directoryItems,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error listing directory:', error);
      res.status(500).json({ 
        error: 'Failed to list directory',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  public async readFile(req: express.Request, res: express.Response) {
    try {
      const { path: filePath } = req.body;
      
      if (!filePath) {
        return res.status(400).json({ error: 'File path is required' });
      }

      console.log('Reading file:', filePath);
      
      const content = await fs.readFile(filePath, 'utf-8');
      
      res.json({
        path: filePath,
        content: content,
        success: true,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error reading file:', error);
      res.status(500).json({ 
        path: req.body.path,
        content: null,
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  }

  public async writeFile(req: express.Request, res: express.Response) {
    try {
      const { path: filePath, content } = req.body;
      
      if (!filePath || content === undefined) {
        return res.status(400).json({ error: 'File path and content are required' });
      }

      console.log('Writing file:', filePath);
      
      await fs.writeFile(filePath, content, 'utf-8');
      
      res.json({
        path: filePath,
        content: content,
        success: true,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error writing file:', error);
      res.status(500).json({ 
        path: req.body.path,
        content: null,
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  }
} 
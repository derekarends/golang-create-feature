import { 
  commands,
  ExtensionContext,
  QuickPickItem,
  QuickPickOptions,
  TextEditor,
  window,
  workspace,
} from 'vscode';

import * as fs from 'fs';
import * as path from 'path';
import * as Q from 'q';
import * as mkdirp from 'mkdirp';

export interface NewFileSettings {
  rootDirectory: string;
  templateDirectory: string;
  templateFiles: string;
}

export class FileController {
  private settings: NewFileSettings;

  private rootPath: string;

  public readSettings(): FileController {
    let config = workspace.getConfiguration('newFile');

    this.settings = {
      rootDirectory: config.get('rootDirectory', this.homedir()),
      templateDirectory: config.get('templateDirectory', 'template'),
      templateFiles: config.get('templateFiles', '')
    };

    return this;
  }


  public determineRoot(): Q.Promise<string> {
    let root = this.settings.rootDirectory;

    if (root.indexOf('~') === 0) {
      root = path.join(this.homedir(), root.substr(1));
    }

    this.rootPath = root;

    return Q(root);
  }
  
  public showFileNameDialog(defaultFileValue: string, fromExplorer: boolean = false): Q.Promise<string> {
    const deferred: Q.Deferred<string> = Q.defer<string>();
    let question = `What's the path and name of the new directory?`;

    window.showInputBox({
      prompt: question,
      value: defaultFileValue
    }).then(selectedFilePath => {
      if (selectedFilePath === null || typeof selectedFilePath === 'undefined') {
        deferred.reject(undefined);
        return;
      }
      selectedFilePath = selectedFilePath || defaultFileValue;
      if (selectedFilePath) {
        if (selectedFilePath.startsWith('./')) {
          deferred.resolve(this.normalizeDotPath(selectedFilePath));
        } else {
          deferred.resolve(this.getFullPath(this.rootPath, selectedFilePath));
        }
      }
    });

    return deferred.promise;
  }

  public createFiles(directory: string): Q.Promise<string[]> {
    const newFileNames = this.settings.templateFiles.split(',');
    const fileCreationPromises: Q.Promise<string>[] = newFileNames.map((fileName) => this.createFile(directory, fileName));
    return Q.all(fileCreationPromises);
  }

  public createFile(directory: string, newFileName: string): Q.Promise<string> {
    const deferred: Q.Deferred<string> = Q.defer<string>();
    
    let directoryExists: boolean = fs.existsSync(directory);
    if (!directoryExists) {
      mkdirp.sync(directory);
    }

    let newFile = directory + "/" + newFileName; 
    
    let fileExists: boolean = fs.existsSync(newFile);
    if(!fileExists){
      let templateDirectory = path.join(this.rootPath, this.settings.templateDirectory, `${newFileName}.tmpl`);
      let fileContent = this.readFile(templateDirectory);
      let folders = directory.split('/');
      let transformedContent = this.replace(fileContent, folders[folders.length-1]);
    
      this.writeFile(newFile, transformedContent);

      deferred.resolve(directory);
    } else {
      deferred.resolve(directory);
    }
     
    return deferred.promise;
  }

  private readFile(src: string): string {
    return fs.readFileSync(src, 'utf-8');
  }

  private replace(src: string, value: string): string {
    let find = '\\[\\[REPLACE\\]\\]';
    var re = new RegExp(find, 'g');

    return src.replace(re, value);
  }

  private writeFile(fileName: string, data: string) {
    fs.writeFileSync(fileName, data, 'utf-8');
  }

  private normalizeDotPath(filePath: string): string {
    const currentFileName: string = window.activeTextEditor ? window.activeTextEditor.document.fileName : '';
    const directory = currentFileName.length > 0 ? path.dirname(currentFileName) : workspace.rootPath;

    return path.resolve(directory, filePath);
  }

  private getFullPath(root: string, filePath: string): string {
    if (filePath.indexOf('/') === 0) {
      return filePath;
    }

    if (filePath.indexOf('~') === 0) {
      return path.join(this.homedir(), filePath.substr(1));
    }

    return path.resolve(root, filePath);
  }
  
  private homedir(): string {
    return process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
  }
}
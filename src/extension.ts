import {
  commands,
  ExtensionContext,
  window
} from 'vscode'

import { FileController } from './file-controller';

export function activate(context: ExtensionContext) {
  let disposable = commands.registerCommand('golang.createNewFeature', () => {

    const File = new FileController().readSettings();

    File.determineRoot()
      .then(fileName => File.showFileNameDialog(fileName))
      .then((fileName) => File.createFiles(fileName))
      .catch((err) => {
        if (err.message) {
          window.showErrorMessage(err.message);
        }
      });
  });

  context.subscriptions.push(disposable);
}
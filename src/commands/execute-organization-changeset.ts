import { Command } from 'commander';
import { ChangeSetProvider } from '../change-set/change-set-provider';
import { ConsoleUtil } from '../console-util';
import { TaskRunner } from '../org-binder/org-task-runner';
import { TemplateRoot } from '../parser/parser';
import { BaseCliCommand, ICommandArgs } from './base-command';

const commandName = 'cexecute-change-set <change-set-name>';
const commandDescription = 'execute previously created change set';

export class ExecuteChangeSetCommand extends BaseCliCommand<IExecuteChangeSetCommandArgs> {

    constructor(command: Command) {
        super(command, commandName, commandDescription, 'changeSetName');
    }

    public addOptions(command: Command) {
        super.addOptions(command);
        command.option('--change-set-name [change-set-name]', 'change set name');
    }

    public async performCommand(command: IExecuteChangeSetCommandArgs) {

        const changeSetName = command.changeSetName;
        const stateBucketName = await this.GetStateBucketName(command);
        const provider = new ChangeSetProvider(stateBucketName);
        const changeSetObj = await provider.getChangeSet(changeSetName);
        if (!changeSetObj) {
            ConsoleUtil.LogError(`change set '${changeSetName}' not found.`);
            return;
        }
        const template = new TemplateRoot(changeSetObj.template, './');
        const state = await this.getState(command);
        const binder = await this.getOrganizationBinder(template, state);
        const tasks = binder.enumBuildTasks();
        const changeSet = ChangeSetProvider.CreateChangeSet(tasks, changeSetName);
        if (JSON.stringify(changeSet) !== JSON.stringify(changeSetObj.changeSet)) {
            ConsoleUtil.LogError(`AWS organization state has changed since creating change set.`);
            return;
        }
        await TaskRunner.RunTasks(tasks);
        state.setPreviousTemplate(template.source);
        await state.save();
    }
}

interface IExecuteChangeSetCommandArgs extends ICommandArgs {
    changeSetName: string;
}
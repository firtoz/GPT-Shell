import {ServerConfigType} from "../../../core/config";

export function getMessageLimitsMessage(config: ServerConfigType) {
    return `Maximum messages per user: ${config.maxMessagePerUser === -1 ? 'Unlimited' : config.maxMessagePerUser}.
                
If you set a positive number for this value, the bot will respond only up to this number of messages from users.

Users with the exception roles can send unlimited number of messages.

${config.exceptionRoleIds.length > 0 ? `Exception roles: ${config.exceptionRoleIds.map(id => `<@&${id}>`)}` : 'No exception roles set. Please define them using role IDs, separated by lines.'}`;
}

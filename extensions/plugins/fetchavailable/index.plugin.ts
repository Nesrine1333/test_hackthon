/*
 * Copyright © 2024 Hexastack. All rights reserved.
 *
 * Licensed under the GNU Affero General Public License v3.0 (AGPLv3) with the following additional terms:
 * 1. The name "Hexabot" is a trademark of Hexastack. You may not use this name in derivative works without express written permission.
 * 2. All derivative works must include clear attribution to the original creator and software, Hexastack and Hexabot, in a prominent location (e.g., in the software's "About" section, documentation, and README file).
 */

import { Injectable } from '@nestjs/common';

import { Block } from '@/chat/schemas/block.schema';
import { Context } from '@/chat/schemas/types/context';
import {
  OutgoingMessageFormat,
  StdOutgoingEnvelope,
  StdOutgoingTextEnvelope,
} from '@/chat/schemas/types/message';
import { ConversationService } from '@/chat/services/conversation.service';
import { BaseBlockPlugin } from '@/plugins/base-block-plugin';
import { PluginService } from '@/plugins/plugins.service';
import { PluginBlockTemplate } from '@/plugins/types';

const API_URL = 'https://api.calendly.com/event_types';
const AVAILABILITY_URL = 'https://api.calendly.com/event_type_available_times';
const BEARER_TOKEN = 'Bearer [YOUR_CALANDLY_ACCESS_TOKEN]';

@Injectable()
export class CalendlyPlugin extends BaseBlockPlugin<any> {
  template: PluginBlockTemplate = { name: 'Calendly Plugin' };

  constructor(
    pluginService: PluginService,
    private readonly conversationService: ConversationService,
  ) {
    super('calendly-plugin', pluginService);
  }

  getPath(): string {
    return __dirname;
  }

  async fetchEventTypeByName(
    name: string,
    user: string,
  ): Promise<string | null> {
    try {
      const url = `${API_URL}?user=${encodeURIComponent(user)}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: BEARER_TOKEN,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      const event = data.collection.find(
        (item: { name: string }) => item.name === name,
      );
      return event ? event.uri : null;
    } catch (error) {
      console.error(
        'Failed to fetch event types from Calendly:',
        error.message,
      );
      return null;
    }
  }

  async fetchAvailableTimes(
    eventTypeUri: string,
    startTime: string,
    endTime: string,
  ): Promise<string[]> {
    try {
      const url = `${AVAILABILITY_URL}?start_time=${encodeURIComponent(
        startTime,
      )}&end_time=${encodeURIComponent(endTime)}&event_type=${encodeURIComponent(
        eventTypeUri,
      )}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: BEARER_TOKEN,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Extract only unique dates from the start_time field
      const uniqueDates: string[] = Array.from(
        new Set(
          data.collection.map(
            (item: { start_time: string }) =>
              new Date(item.start_time).toISOString().split('T')[0],
          ),
        ),
      );

      return uniqueDates;
    } catch (error) {
      console.error(
        'Failed to fetch available times from Calendly:',
        error.message,
      );
      return [];
    }
  }

  async process(
    block: Block,
    _context: Context,
    _convId: string,
  ): Promise<StdOutgoingEnvelope> {
    const args = this.getArguments(block);

    const eventName = _context.text; //contextvar
    const user =
      'https://api.calendly.com/users/4eff9ab6-ea27-4924-9e75-8a23a3aa5513'; //contextvar
    const startTime = '2024-12-30T14:18:22.123456Z';
    const endTime = '2024-12-31T14:18:22.123456Z';

    if (!eventName || !user || !startTime || !endTime) {
      return {
        format: OutgoingMessageFormat.text,
        message: {
          text: 'Event name, user, start time, and end time are required.',
        },
      };
    }

    const uri = await this.fetchEventTypeByName(eventName, user);
    await this.conversationService.updateOne(_convId, {
      ['context.vars.typeuri' as any]: uri,
    });

    if (!uri) {
      return {
        format: OutgoingMessageFormat.text,
        message: {
          text: `Event "${eventName}" not found for user "${user}".`,
        },
      };
    }

    const availableTimes = await this.fetchAvailableTimes(
      uri,
      startTime,
      endTime,
    );

    const envelope: StdOutgoingTextEnvelope = {
      format: OutgoingMessageFormat.text,
      message: {
        text: availableTimes.length
          ? `Available times for event "${eventName}":\n${availableTimes.join(
              '\n',
            )}`
          : `No available times found for event "${eventName}" within the given time range.`,
      },
    };

    return envelope as StdOutgoingEnvelope;
  }
}

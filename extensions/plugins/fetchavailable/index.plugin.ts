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
import { BaseBlockPlugin } from '@/plugins/base-block-plugin';
import { PluginService } from '@/plugins/plugins.service';
import { PluginBlockTemplate } from '@/plugins/types';

const API_URL = 'https://api.calendly.com/event_types';
const AVAILABILITY_URL = 'https://api.calendly.com/event_type_available_times';
const BEARER_TOKEN =
  'Bearer eyJraWQiOiIxY2UxZTEzNjE3ZGNmNzY2YjNjZWJjY2Y4ZGM1YmFmYThhNjVlNjg0MDIzZjdjMzJiZTgzNDliMjM4MDEzNWI0IiwidHlwIjoiUEFUIiwiYWxnIjoiRVMyNTYifQ.eyJpc3MiOiJodHRwczovL2F1dGguY2FsZW5kbHkuY29tIiwiaWF0IjoxNzM0ODAwNjUyLCJqdGkiOiI0MWY3MjEyNC05YWQ0LTQ2NDEtODEzNi03MzUwY2Y1MjBjMjQiLCJ1c2VyX3V1aWQiOiI0ZWZmOWFiNi1lYTI3LTQ5MjQtOWU3NS04YTIzYTNhYTU1MTMifQ.XfA2AteEQ51DDxnmY0dA_SxrScbSKmZ-3rWbQV3rLWyfkrpDmy9ac15gJ7fLP4YNevdLuomtFoRFtZjTulONNg';

@Injectable()
export class CalendlyPlugin extends BaseBlockPlugin<any> {
  template: PluginBlockTemplate = { name: 'Calendly Plugin' };

  constructor(pluginService: PluginService) {
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
      return data.collection.map(
        (item: { start_time: string }) => item.start_time,
      );
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

    const eventName = 'test_event'; //contextvar
    const user = "https://api.calendly.com/users/4eff9ab6-ea27-4924-9e75-8a23a3aa5513";//contextvar
    const startTime = '2024-12-30T14:18:22.123456Z';
    const endTime ='2024-12-31T14:18:22.123456Z';

    if (!eventName || !user || !startTime || !endTime) {
      return {
        format: OutgoingMessageFormat.text,
        message: {
          text: 'Event name, user, start time, and end time are required.',
        },
      };
    }

    const uri = await this.fetchEventTypeByName(eventName, user);

    if (!uri) {
      return {
        format: OutgoingMessageFormat.text,
        message: {
          text: `Event "${eventName}" not found for user "${user}".`,
        },
      };
    }

    const availableTimes = await this.fetchAvailableTimes(uri, startTime, endTime);

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
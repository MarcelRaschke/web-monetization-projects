import { inject, injectable } from 'inversify'
import { GraphQlClient } from '@coil/client'
import { DocumentMonetization } from '@web-monetization/wext/content'

import * as tokens from '../../types/tokens'
import { getAdaptedSite } from '../util/getAdaptedSite'
import { debug } from '../util/logging'
import { ContentRuntime } from '../types/ContentRunTime'
import { FetchYoutubeChannelId } from '../../types/commands'

import { Frames } from './Frames'

interface GetPageData {
  adaptedPage: {
    paymentPointer: string
    channelImage: string
  }
}

@injectable()
export class AdaptedContentService {
  // Keep track of invocations of checkAdaptedContent so we can abort
  // on stale operations
  private runs = 0

  private constructor(
    private monetization: DocumentMonetization,
    @inject(tokens.ContentRuntime)
    private contentRuntime: ContentRuntime,
    private window: Window,
    private client: GraphQlClient
  ) {}

  async fetchChannelId(videoUrl: string) {
    return new Promise<string | null>(resolve => {
      const message: FetchYoutubeChannelId = {
        command: 'fetchYoutubeChannelId',
        data: {
          youtubeUrl: videoUrl
        }
      }
      this.contentRuntime.sendMessage(message, resolve)
    })
  }

  async adaptedPageDetails(url: string, site: string) {
    debug('fetching payment pointer for this page', url, site)

    const variables = { url }

    if (site === 'youtube') {
      const channelId = await this.fetchChannelId(url)
      debug('channelId', { channelId })
      if (channelId) {
        debug('found channel id', channelId, 'for', url)
        Object.assign(variables, { channelId })
      }
    }

    const query = `query getPage($url: String!, $channelId: String) {
  adaptedPage(videoUrl: $url, channelId: $channelId) {
    paymentPointer
    channelImage
  }
}`

    const paymentPointerQuery = await this.client.query<GetPageData>({
      query,
      token: null,
      variables
    })

    debug({ paymentPointerQuery })

    const data = paymentPointerQuery.data
    const adaptedPage = data?.adaptedPage
    const paymentPointer = adaptedPage?.paymentPointer
    const channelImage = adaptedPage?.channelImage
    return {
      channelImage,
      paymentPointer
    }
  }

  async checkAdaptedContent() {
    const run = ++this.runs
    const currentUrl = this.window.location.href
    debug('Checking for adapted content', currentUrl)
    const adaptedSite = getAdaptedSite(currentUrl)

    if (adaptedSite) {
      const { channelImage, paymentPointer } = await this.adaptedPageDetails(
        currentUrl,
        adaptedSite
      )
      if (this.runs !== run) {
        debug('stale checkAdaptedContent')
        return
      }
      if (!paymentPointer) {
        debug('page is not monetized. url=', currentUrl)
        this.monetization.setMetaTagContent(undefined)
      } else {
        this.contentRuntime.sendMessage({
          command: 'adaptedSite',
          data: {
            state: true,
            channelImage
          }
        })
        this.monetization.setMetaTagContent(paymentPointer)
      }
    }
  }
}

import { NextRequest, NextResponse } from 'next/server';

const PIXABAY_API_URL = 'https://pixabay.com/api/';
const PEXELS_API_URL = 'https://api.pexels.com/v1/search';

interface StandardAsset {
  id: string;
  source: 'pixabay' | 'pexels';
  previewUrl: string;
  largeUrl: string;
  author: string;
  authorUrl?: string;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('query');
    const source = searchParams.get('source'); // 'pixabay' | 'pexels' | 'both'
    const page = searchParams.get('page') || '1';
    const assetType = searchParams.get('type') || 'all'; // 'all' | 'photo' | 'graphic'
    const limit = 20;

    if (!query) {
      return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
    }

    const results: StandardAsset[] = [];
    const errors: string[] = [];

    // Fetch from Pixabay
    if (source === 'pixabay' || source === 'both') {
      const apiKey = process.env.PIXABAY_API;
      if (!apiKey) {
        // Securely handle missing keys without exposing secrets
        errors.push('Pixabay service unavailable (configuration missing)');
      } else {
        try {
          // Smart Pixabay filtering
          let pixabayType = 'photo';
          let extraParams = '';
          if (assetType === 'graphic') {
            pixabayType = 'illustration'; // Get illustrations/graphics
            extraParams = '&colors=transparent'; // Force transparent backgrounds (usually PNGs)
          } else if (assetType === 'all') {
            pixabayType = 'all';
          }
          
          const res = await fetch(`${PIXABAY_API_URL}?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(query)}&page=${encodeURIComponent(page)}&per_page=${limit}&image_type=${pixabayType}&safesearch=true${extraParams}`);
          if (!res.ok) throw new Error(`Pixabay API error: ${res.status}`);
          const data = await res.json();
          const mapped = data.hits.map((hit: any) => ({
            id: `pxb-${hit.id}`,
            source: 'pixabay',
            previewUrl: hit.previewURL,
            largeUrl: hit.largeImageURL,
            author: hit.user,
            authorUrl: `https://pixabay.com/users/${hit.user}-${hit.user_id}/`
          }));
          
          // Strict post-filtering if looking for transparent graphics
          // Pixabay returns .png for transparent graphics
          const filtered = assetType === 'graphic' 
            ? mapped.filter((m: StandardAsset) => m.largeUrl.toLowerCase().endsWith('.png'))
            : mapped;
            
          results.push(...filtered);
        } catch (e: any) {
          errors.push('Failed to fetch from Pixabay');
          // TODO(security): Securely log error locally without exposing keys
        }
      }
    }

    // Fetch from Pexels
    if ((source === 'pexels' || source === 'both') && assetType !== 'graphic') {
      const apiKey = process.env.PIXELS_API;
      if (!apiKey) {
        errors.push('Pexels service unavailable (configuration missing)');
      } else {
        try {
          const res = await fetch(`${PEXELS_API_URL}?query=${encodeURIComponent(query)}&page=${encodeURIComponent(page)}&per_page=${limit}`, {
            headers: { Authorization: apiKey }
          });
          if (!res.ok) throw new Error(`Pexels API error: ${res.status}`);
          const data = await res.json();
          const mapped = data.photos.map((photo: any) => ({
            id: `pex-${photo.id}`,
            source: 'pexels',
            previewUrl: photo.src.medium,
            largeUrl: photo.src.large2x,
            author: photo.photographer,
            authorUrl: photo.photographer_url
          }));
          results.push(...mapped);
        } catch (e: any) {
          errors.push('Failed to fetch from Pexels');
          // TODO(security): Securely log error locally without exposing keys
        }
      }
    }

    // Shuffle combined results for a mix of both platforms
    for (let i = results.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [results[i], results[j]] = [results[j], results[i]];
    }

    return NextResponse.json({
      data: results,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    // Fail safe error handling
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

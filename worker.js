export default {
    async fetch(request, env) {
        return handleRequest(env);
    }
};

async function handleRequest(env, request) {
    const images = await fetchFlickrImages(env);

    if (images.length === 0) {
        return new Response(JSON.stringify({ image: env.FALLBACK_IMAGE }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // Retrieve the current index from KV storage
    let currentIndex = parseInt(await env.KV_STORE.get('currentIndex')) || 0;

    // Serve the current image
    const imageUrl = images[currentIndex];

    // Increment the index and loop back if needed
    const newIndex = (currentIndex + 1) % images.length;
    await env.KV_STORE.put('currentIndex', newIndex.toString());

    return new Response(JSON.stringify({ image: imageUrl }), {
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-store'
        }
    });
}

// Cache the album and fetch it from Flickr
async function fetchFlickrImages(env) {
    const cache = caches.default;
    const cacheKey = `flickr-album-${env.FLICKR_ALBUM_ID}`;

    let response = await cache.match(cacheKey);
    if (response) {
        return await response.json();
    }

    const url = `https://www.flickr.com/services/rest/?method=flickr.photosets.getPhotos&api_key=${env.FLICKR_API_KEY}&photoset_id=${env.FLICKR_ALBUM_ID}&user_id=${env.FLICKR_USER_ID}&format=json&nojsoncallback=1`;

    try {
        response = await fetch(url);
        const data = await response.json();

        const imageUrls = data.photoset.photo.map(photo =>
            `https://live.staticflickr.com/${photo.server}/${photo.id}_${photo.secret}_b.jpg`
        );

        // Cache the full album for 24 hours
        response = new Response(JSON.stringify(imageUrls), {
            headers: { 'Content-Type': 'application/json' }
        });
        response.headers.append('Cache-Control', 'max-age=86400');
        cache.put(cacheKey, response.clone());

        return imageUrls;
    } catch (error) {
        console.error('Error fetching Flickr images:', error);
        return [env.FALLBACK_IMAGE];
    }
}

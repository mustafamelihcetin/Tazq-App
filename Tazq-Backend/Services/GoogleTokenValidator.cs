using Google.Apis.Auth;

namespace Tazq_App.Services
{
	public class GoogleTokenValidator : IGoogleTokenValidator
	{
		/*
		  GOOGLE DOĞRULAMASINA ÜST SINIR.

		  `GoogleJsonWebSignature.ValidateAsync` imzayı doğrulamak için Google'ın
		  sertifika ucuna gidebilir (önbelleği boşsa ya da bayatsa) ve kendi HTTP
		  istemcisini kullanır — dışarıdan zaman aşımı verilemez, CancellationToken
		  parametresi de yoktur. Yani Google tarafı yavaşladığında bu çağrı, giriş
		  isteğini SINIRSIZ süre bekletebiliyordu.

		  DÜRÜST SINIR: `WaitAsync` altta çalışan HTTP isteğini İPTAL ETMEZ; yalnız
		  BİZİM beklememizi keser. Kazanç yine de gerçek — sınırlanan şey, kullanıcının
		  ekranda beklediği süre ve bir istek işleyicisinin ne kadar tutulduğu.
		  Arkada kalan çağrı kendi kendine sonlanır ve sonucu kimse okumaz.

		  Zaman aşımında `TimeoutException` fırlar; çağıran (UserService.GoogleLoginAsync)
		  her istisnayı yakalayıp loglayarak null dönüyor — yani sonuç "doğrulanamadı"
		  ile aynı, ayrı bir hata yolu açılmıyor.
		*/
		private static readonly TimeSpan ValidationTimeout = TimeSpan.FromSeconds(10);

		public async Task<GoogleJsonWebSignature.Payload?> ValidateAsync(string idToken)
		{
			return await GoogleJsonWebSignature.ValidateAsync(idToken).WaitAsync(ValidationTimeout);
		}
	}
}

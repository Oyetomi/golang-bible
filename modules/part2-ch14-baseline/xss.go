package baseline

import (
	htmpl "html/template"
	"strings"
	ttmpl "text/template"
)

const page = `<p>Hello, {{.Name}}!</p><a href="/u?q={{.Name}}">profile</a><script>var n = {{.Name}};</script>`

func RenderHTML(name string) string {
	var b strings.Builder
	htmpl.Must(htmpl.New("p").Parse(page)).Execute(&b, map[string]string{"Name": name})
	return b.String()
}

func RenderText(name string) string {
	var b strings.Builder
	ttmpl.Must(ttmpl.New("p").Parse(page)).Execute(&b, map[string]string{"Name": name})
	return b.String()
}

// RenderTrusted marks the value as already-safe HTML, which switches the escaping off.
func RenderTrusted(name string) string {
	var b strings.Builder
	htmpl.Must(htmpl.New("p").Parse(`<p>Hello, {{.Name}}!</p>`)).Execute(&b, map[string]htmpl.HTML{"Name": htmpl.HTML(name)})
	return b.String()
}

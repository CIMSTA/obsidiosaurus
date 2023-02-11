# INDEX Sidebar 1

## EN Version

Sidebar 1 supports multiple languages: en, de

# Standard Formatting

##  Links

[Link to same sidebar](docs/sidebar1/1.%20Topic%201/note1/note1__de.md)

[Link to other sidebar](docs/sidebar2/1.%20Topic%20Y/1.%20Note%20Y1.md)

[Link to blog](blog/2022-01-24-Post1/2022-01-24-Post1__en.md)

[Link to release notes (multi blog)](release_notes__blog/2022-01-01-release_v1/release_v1__en.md)

## Tables

| Column 1 | Column 2 | Column 3 | 
|----------|----------|----------|
| Row 1, Column 1 | Row 1, Column 2 | Row 1, Column 3 | 
| Row 2, Column 1 | Row 2, Column 2 | Row 2, Column 3 |
| Row 3, Column 1 | Row 3, Column 2 | Row 3, Column 3 |`

## Admonitions

>[!note] Title XYZ
>This is a note with a title
>Some **content** with _Markdown_ `syntax`.

>[!note] 
>This is a note without a title
>Some **content** with _Markdown_ `syntax`.

>[!tip]
>Some **content** with _Markdown_ `syntax`.

>[!info]
>Some **content** with _Markdown_ `syntax`.

>[!caution]
>Some **content** with _Markdown_ `syntax`.

>[!danger]
>Some **content** with _Markdown_ `syntax`.

## Quote

>This is a random quote!
>- me

## Codeblocks

```python
while x < 15:
	if x % 2 == 0:
		x += 1
		continue
	print("Odd:", x)
	x += 1
```

## Checklists

- [x] Checked
- [ ] Unchecked

# Assets

## Images

![](assets/coffee.png)
Image width 5472px -> gets reduced to 2500px

## Image resize

![Coffee Image|700](assets/coffee.png)
Set to a width of 700px

![Coffee Image|300x300](assets/coffee.png)
Set to a width and heigth of 300px 

## Files

![Coffee PDF](assets/coffee.pdf)


# Drawings & Diagrams

## Excalidraw

![[assets/index__en 2023-02-11 18.26.31.excalidraw]]

## Diagrams.net

![[assets/Diagram.svg]]

## Math Equations

Let $f\colon[a,b]\to\R$ be Riemann integrable. Let $F\colon[a,b]\to\R$ be$F(x)=\int_{a}^{x} f(t)\,dt$. Then $F$ is continuous, and at all $x$ such that$f$ is continuous at $x$, $F$ is differentiable at $x$ with $F'(x)=f(x)$.


$$I = \int_0^{2\pi} \sin(x)\,dx$$

## Mermaid


```mermaid
graph TD;    
A-->B;    
A-->C;    
B-->D;    
C-->D;
```

